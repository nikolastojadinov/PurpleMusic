import { normalize, toSeconds } from '../ingest/utils';

export type YTThumbnail = { url: string; width?: number; height?: number };

export type YTMusicTrack = {
  videoId: string;
  title: string;
  artist: string;
  artists: string[];
  duration: number | null;
  thumbnail: string | null;
  thumbnails: YTThumbnail[];
};

export type ArtistBrowse = {
  browseId: string;
  name: string;
  description: string | null;
  channelId: string;
  thumbnails: YTThumbnail[];
  topSongs: YTMusicTrack[];
  albums: Array<{ id: string; title: string; year: string | null; thumbnail: string | null; thumbnails: YTThumbnail[]; trackCount: number | null }>;
  playlists: Array<{ id: string; title: string; thumbnail: string | null; thumbnails: YTThumbnail[] }>;
};

export type AlbumBrowse = {
  browseId: string;
  title: string;
  thumbnail: string | null;
  thumbnails: YTThumbnail[];
  releaseDate: string | null;
  trackCount: number | null;
  tracks: YTMusicTrack[];
};

export type PlaylistBrowse = {
  browseId: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  thumbnails: YTThumbnail[];
  tracks: YTMusicTrack[];
};

const CONSENT_COOKIES =
  'CONSENT=YES+1; SOCS=CAESHAgBEhIaZ29vZ2xlLmNvbS9jb25zZW50L2Jhc2ljLzIiDFNvaURtdXhSNVQ1ag==; PREF=f1=50000000&hl=en';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.6167.100 Safari/537.36';
const API_BASE = 'https://music.youtube.com/youtubei/v1';

// Use the runtime fetch if available; typed as any to avoid DOM lib dependency.
type FetchLike = (input: any, init?: any) => Promise<any>;
const fetchFn: FetchLike = (globalThis as any).fetch;

if (!fetchFn) {
  throw new Error('Global fetch is required for innertube client');
}

type InnertubeConfig = {
  apiKey: string;
  clientName: string;
  clientVersion: string;
  visitorData: string;
  apiBase: string;
};

let configPromise: Promise<InnertubeConfig> | null = null;

function pickText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node.trim();
  if (Array.isArray(node)) return pickText(node[0]);
  const runs = node.runs;
  if (Array.isArray(runs)) return pickText(runs[0]);
  if (typeof node.text === 'string') return node.text.trim();
  return '';
}

function collectThumbnails(...sources: any[]): YTThumbnail[] {
  const out: YTThumbnail[] = [];
  const seen = new Set<string>();

  sources.forEach((src) => {
    const candidates = [
      src?.thumbnail?.thumbnails,
      src?.thumbnailRenderer?.thumbnail?.thumbnails,
      src?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails,
      src?.musicThumbnailRenderer?.thumbnail?.thumbnails,
      src?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails,
      src?.thumbnails,
    ];

    candidates.forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((t) => {
        const url = normalize((t as any)?.url);
        if (!url || seen.has(url)) return;
        seen.add(url);
        out.push({ url, width: (t as any)?.width, height: (t as any)?.height });
      });
    });
  });

  return out;
}

function pickDescription(root: any): string | null {
  const desc = root?.contents?.sectionListRenderer?.contents?.find((c: any) => c?.musicDescriptionShelfRenderer)?.musicDescriptionShelfRenderer;
  const runs = desc?.description?.runs;
  if (Array.isArray(runs)) {
    const text = runs.map((r: any) => r?.text || '').join(' ').trim();
    return text || null;
  }
  const shelf = root?.header?.musicImmersiveHeaderRenderer?.description;
  const shelfRuns = shelf?.runs;
  if (Array.isArray(shelfRuns)) {
    const text = shelfRuns.map((r: any) => r?.text || '').join(' ').trim();
    return text || null;
  }
  return null;
}

function buildContext(config: InnertubeConfig): any {
  return {
    client: {
      clientName: config.clientName || 'WEB_REMIX',
      clientVersion: config.clientVersion,
      hl: 'en',
      gl: 'US',
      platform: 'DESKTOP',
      visitorData: config.visitorData,
      userAgent: USER_AGENT,
      utcOffsetMinutes: 0,
    },
    user: { enableSafetyMode: false },
    request: { internalExperimentFlags: [], sessionIndex: 0 },
  };
}

async function loadInnertubeConfig(): Promise<InnertubeConfig> {
  const urls = ['https://music.youtube.com/?hl=en&gl=US', 'https://www.youtube.com/?hl=en&gl=US'];
  const headers = {
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': USER_AGENT,
    Cookie: CONSENT_COOKIES,
  };
  const errors: string[] = [];

  for (const url of urls) {
    try {
      const res = await fetchFn(url, { method: 'GET', headers });
      if (!res?.ok) {
        errors.push(`${url}:status_${res?.status ?? 'unknown'}`);
        continue;
      }
      const html = await res.text();
      const extracted = extractConfigFromHtml(html);
      if (extracted.apiKey && extracted.clientName && extracted.clientVersion && extracted.visitorData) {
        return {
          apiKey: extracted.apiKey,
          clientName: extracted.clientName,
          clientVersion: extracted.clientVersion,
          visitorData: extracted.visitorData,
          apiBase: API_BASE,
        };
      }
      errors.push(`${url}:missing_fields`);
    } catch (err: any) {
      errors.push(`${url}:${err?.message || 'fetch_failed'}`);
    }
  }

  throw new Error(`innertube_config_failed:${errors.join('|')}`);
}

function extractConfigFromHtml(html: string): Partial<InnertubeConfig> {
  const fields: Partial<InnertubeConfig> = {};

  const ytcfgMatch = html.match(/ytcfg\.set\((\{[\s\S]*?\})\);/);
  if (ytcfgMatch?.[1]) {
    try {
      const cfg = JSON.parse(ytcfgMatch[1]);
      const ctx = cfg?.INNERTUBE_CONTEXT?.client || {};
      fields.apiKey = cfg?.INNERTUBE_API_KEY;
      fields.clientName = ctx?.clientName;
      fields.clientVersion = ctx?.clientVersion;
      fields.visitorData = ctx?.visitorData;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn('[innertube][ytcfg_parse_failed]', message);
    }
  }

  const regexGrab = (key: string) => {
    const m = html.match(new RegExp(`"${key}"\s*:\s*"([^"]+)"`));
    return m?.[1];
  };

  fields.apiKey = fields.apiKey || regexGrab('INNERTUBE_API_KEY');
  fields.clientName = fields.clientName || regexGrab('INNERTUBE_CLIENT_NAME');
  fields.clientVersion = fields.clientVersion || regexGrab('INNERTUBE_CLIENT_VERSION');
  fields.visitorData = fields.visitorData || regexGrab('VISITOR_DATA');

  return fields;
}

async function getInnertubeConfig(): Promise<InnertubeConfig> {
  if (!configPromise) {
    configPromise = loadInnertubeConfig();
  }
  return configPromise;
}

async function callYoutubei<T>(path: string, payload: Record<string, any>, referer: string): Promise<T | null> {
  const config = await getInnertubeConfig();
  const url = `${config.apiBase.replace(/\/$/, '')}/${path}?prettyPrint=false&key=${encodeURIComponent(config.apiKey)}`;
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': USER_AGENT,
        Origin: 'https://music.youtube.com',
        Referer: referer,
        Cookie: CONSENT_COOKIES,
        'X-Goog-Visitor-Id': config.visitorData,
        'X-YouTube-Client-Version': config.clientVersion,
        'X-YouTube-Client-Name': '67',
      },
      body: JSON.stringify(payload),
    });

    if (!res?.ok) {
      console.warn('[innertube][request_failed]', { path, status: res?.status });
      return null;
    }
    const json = await res.json().catch(() => null);
    return json as T | null;
  } catch (err: any) {
    console.error('[innertube][request_error]', { path, message: err?.message || 'request_failed' });
    return null;
  }
}

function walkAll(root: any, visit: (node: any) => void): void {
  const stack: any[] = [root];
  const seen = new WeakSet<object>();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== 'object') continue;
    if (seen.has(node)) continue;
    seen.add(node);
    visit(node);
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
    } else {
      for (const value of Object.values(node)) stack.push(value);
    }
  }
}

function extractArtistBrowseIdFromSearch(root: any): string | null {
  let official: string | null = null;
  const fallbacks: string[] = [];

  walkAll(root, (node) => {
    const nav = (node as any)?.navigationEndpoint?.browseEndpoint;
    const browseId = normalize(nav?.browseId);
    if (!browseId) return;
    const pageType = nav?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
    const isArtistPage = typeof pageType === 'string' && pageType.includes('ARTIST');
    const isOfficialId = /^(UC|MPLA)/i.test(browseId);
    if (isArtistPage && isOfficialId && !official) {
      official = browseId;
      return;
    }
    if (isArtistPage && !official) {
      official = browseId;
      return;
    }
    if (isOfficialId) fallbacks.push(browseId);
  });

  if (official) return official;
  return fallbacks[0] || null;
}

function pickArtists(node: any, fallbackArtist: string): string[] {
  const text =
    normalize(pickText(node?.subtitle)) ||
    normalize(node?.longBylineText?.runs?.[0]?.text) ||
    normalize(node?.shortBylineText?.runs?.[0]?.text) ||
    normalize(node?.playlistPanelVideoRenderer?.longBylineText?.runs?.[0]?.text) ||
    fallbackArtist ||
    'Unknown artist';

  if (!text) return [];
  return text
    .split(/[,•&]/)
    .map((s) => normalize(s))
    .filter(Boolean);
}

function parseSongFromNode(node: any, fallbackArtist: string): YTMusicTrack | null {
  const watch = node?.navigationEndpoint?.watchEndpoint || node?.watchEndpoint || node?.playlistPanelVideoRenderer;
  const videoId = normalize(node?.videoId || watch?.videoId || node?.playlistPanelVideoRenderer?.videoId);
  if (!videoId) return null;

  const title =
    normalize(pickText(node?.title)) ||
    normalize(node?.playlistPanelVideoRenderer?.title?.runs?.[0]?.text) ||
    normalize(node?.headline?.runs?.[0]?.text) ||
    'Untitled';

  const artists = pickArtists(node, fallbackArtist);
  const artist = artists[0] || fallbackArtist || 'Unknown artist';

  const durationRaw =
    pickText(node?.lengthText) ||
    pickText(node?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text);
  const duration = toSeconds(durationRaw);

  const thumbnails = collectThumbnails(
    node,
    node?.thumbnail,
    node?.thumbnailRenderer,
    node?.thumbnailOverlays,
    node?.musicThumbnailRenderer,
  );
  const thumbnail = thumbnails.at(-1)?.url ?? null;

  return {
    videoId,
    title: title || 'Untitled',
    artist: artist || 'Unknown artist',
    artists,
    duration,
    thumbnail,
    thumbnails,
  };
}

function parseSongsFromBrowse(root: any, artistName: string): YTMusicTrack[] {
  const tracks: YTMusicTrack[] = [];

  walkAll(root, (node) => {
    if (node?.musicResponsiveListItemRenderer) {
      const parsed = parseSongFromNode(node.musicResponsiveListItemRenderer, artistName);
      if (parsed) tracks.push(parsed);
    }
    if (node?.playlistPanelVideoRenderer) {
      const parsed = parseSongFromNode(node.playlistPanelVideoRenderer, artistName);
      if (parsed) tracks.push(parsed);
    }
    if (node?.playlistVideoRenderer) {
      const parsed = parseSongFromNode(node.playlistVideoRenderer, artistName);
      if (parsed) tracks.push(parsed);
    }
  });

  const seen = new Set<string>();
  const deduped = tracks.filter((t) => {
    if (seen.has(t.videoId)) return false;
    seen.add(t.videoId);
    return true;
  });

  if (deduped.length) {
    console.log('[debug][parser] firstTrack.thumbnails', deduped[0]?.thumbnails || []);
  }

  return deduped;
}

function parseAlbumOrPlaylistFromTwoRow(node: any):
  | { album?: { id: string; title: string; year: string | null; thumbnail: string | null; thumbnails: YTThumbnail[] }; playlist?: { id: string; title: string; thumbnail: string | null; thumbnails: YTThumbnail[] } }
  | null {
  const nav = node?.navigationEndpoint?.browseEndpoint;
  const browseId = normalize(nav?.browseId);
  if (!browseId) return null;
  const title = pickText(node?.title) || browseId;
  const subtitle = pickText(node?.subtitle);
  const thumbnails = collectThumbnails(node?.thumbnailRenderer, node?.thumbnail);
  const thumb = thumbnails.at(-1)?.url ?? null;
  const yearMatch = subtitle.match(/(20\d{2}|19\d{2})/);
  const year = yearMatch ? yearMatch[1] : null;
  const pageType = nav?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

  if (typeof pageType === 'string' && pageType.includes('ALBUM')) {
    return { album: { id: browseId, title: normalize(title) || 'Album', year, thumbnail: thumb, thumbnails } };
  }

  if (typeof pageType === 'string' && pageType.includes('PLAYLIST')) {
    return { playlist: { id: browseId, title: normalize(title) || 'Playlist', thumbnail: thumb, thumbnails } };
  }

  if (/^MPRE/i.test(browseId)) {
    return { album: { id: browseId, title: normalize(title) || 'Album', year, thumbnail: thumb, thumbnails } };
  }

  if (/^(VL|PL|OLAK)/i.test(browseId)) {
    return { playlist: { id: browseId, title: normalize(title) || 'Playlist', thumbnail: thumb, thumbnails } };
  }

  return null;
}

function parseAlbumsAndPlaylists(root: any): { albums: ArtistBrowse['albums']; playlists: ArtistBrowse['playlists'] } {
  const albums: ArtistBrowse['albums'] = [];
  const playlists: ArtistBrowse['playlists'] = [];

  walkAll(root, (node) => {
    if (node?.musicTwoRowItemRenderer) {
      const parsed = parseAlbumOrPlaylistFromTwoRow(node.musicTwoRowItemRenderer);
      if (parsed?.album) albums.push({ ...parsed.album, trackCount: null });
      if (parsed?.playlist) playlists.push(parsed.playlist);
    }
    if (node?.musicResponsiveListItemRenderer) {
      const nav = node.musicResponsiveListItemRenderer?.navigationEndpoint?.browseEndpoint;
      const browseId = normalize(nav?.browseId);
      const pageType = nav?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
      const title = pickText(
        node.musicResponsiveListItemRenderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text,
      );
      const thumbnails = collectThumbnails(node.musicResponsiveListItemRenderer?.thumbnail);
      const thumb = thumbnails.at(-1)?.url ?? null;

      if (browseId && typeof pageType === 'string' && pageType.includes('ALBUM')) {
        albums.push({ id: browseId, title: normalize(title) || browseId, year: null, thumbnail: thumb, thumbnails, trackCount: null });
      }
      if (browseId && typeof pageType === 'string' && pageType.includes('PLAYLIST')) {
        playlists.push({ id: browseId, title: normalize(title) || browseId, thumbnail: thumb, thumbnails });
      }
    }
  });

  const seenAlbums = new Set<string>();
  const seenPlaylists = new Set<string>();

  return {
    albums: albums.filter((a) => {
      if (!a.id || seenAlbums.has(a.id)) return false;
      seenAlbums.add(a.id);
      return true;
    }),
    playlists: playlists.filter((p) => {
      if (!p.id || seenPlaylists.has(p.id)) return false;
      seenPlaylists.add(p.id);
      return true;
    }),
  };
}

export async function resolveArtistBrowseIdByName(nameRaw: string): Promise<string | null> {
  const name = normalize(nameRaw);
  if (!name) return null;
  const config = await getInnertubeConfig();
  const payload = { context: buildContext(config), query: name };
  const json = await callYoutubei<any>('search', payload, `https://music.youtube.com/search?q=${encodeURIComponent(name)}`);
  if (!json) return null;
  return extractArtistBrowseIdFromSearch(json);
}

export async function fetchArtistBrowse(browseIdRaw: string): Promise<ArtistBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  const config = await getInnertubeConfig();
  const payload = { context: buildContext(config), browseId };
  const json = await callYoutubei<any>('browse', payload, `https://music.youtube.com/channel/${encodeURIComponent(browseId)}`);
  if (!json) return null;

  const header = json?.header?.musicImmersiveHeaderRenderer || json?.header?.musicHeaderRenderer;
  const name = normalize(pickText(header?.title)) || browseId;
  const channelId = normalize(header?.subscriptionButton?.subscribeButtonRenderer?.channelId) || browseId;
  const thumbnails = collectThumbnails(header?.thumbnail?.musicThumbnailRenderer, header?.thumbnail);
  const topSongs = parseSongsFromBrowse(json, name).slice(0, 10);
  const { albums, playlists } = parseAlbumsAndPlaylists(json);
  const description = pickDescription(json);

  if (topSongs.length) {
    console.log('[debug][parser] firstTrack.thumbnails', topSongs[0]?.thumbnails || []);
  }

  return {
    browseId,
    name,
    description,
    channelId: channelId || browseId,
    thumbnails,
    topSongs,
    albums,
    playlists,
  };
}

export async function fetchAlbumBrowse(browseIdRaw: string): Promise<AlbumBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  const config = await getInnertubeConfig();
  const payload = { context: buildContext(config), browseId };
  const json = await callYoutubei<any>('browse', payload, `https://music.youtube.com/playlist?list=${encodeURIComponent(browseId)}`);
  if (!json) return null;

  const header = json?.header?.musicDetailHeaderRenderer || json?.header?.musicTwoRowHeaderRenderer;
  const title = normalize(pickText(header?.title)) || browseId;
  const subtitle = pickText(header?.subtitle);
  const yearMatch = subtitle.match(/(20\d{2}|19\d{2})/);
  const releaseDate = yearMatch ? `${yearMatch[1]}-01-01` : null;
  const thumbnails = collectThumbnails(header?.thumbnail?.musicThumbnailRenderer, header?.thumbnail);
  const thumbnail = thumbnails.at(-1)?.url ?? null;
  const tracks = parseSongsFromBrowse(json, pickText(header?.subtitle)).map((t) => ({ ...t, artist: t.artist || pickText(header?.subtitle) }));

  if (tracks.length) {
    console.log('[debug][parser] firstTrack.thumbnails', tracks[0]?.thumbnails || []);
  }

  return {
    browseId,
    title,
    thumbnail,
    thumbnails,
    releaseDate,
    trackCount: tracks.length || null,
    tracks,
  };
}

export async function fetchPlaylistBrowse(browseIdRaw: string): Promise<PlaylistBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  const config = await getInnertubeConfig();
  const payload = { context: buildContext(config), browseId };
  const json = await callYoutubei<any>('browse', payload, `https://music.youtube.com/playlist?list=${encodeURIComponent(browseId)}`);
  if (!json) return null;

  const header = json?.header?.musicDetailHeaderRenderer || json?.header?.musicTwoRowHeaderRenderer;
  const title = normalize(pickText(header?.title)) || browseId;
  const subtitle = normalize(pickText(header?.subtitle)) || null;
  const thumbnails = collectThumbnails(header?.thumbnail?.musicThumbnailRenderer, header?.thumbnail);
  const thumbnail = thumbnails.at(-1)?.url ?? null;
  const tracks = parseSongsFromBrowse(json, subtitle || title);

  if (tracks.length) {
    console.log('[debug][parser] firstTrack.thumbnails', tracks[0]?.thumbnails || []);
  }

  return {
    browseId,
    title,
    subtitle,
    thumbnail,
    thumbnails,
    tracks,
  };
}

// Backwards-compatible helper matching legacy browsePlaylistById API.
export async function browsePlaylistById(playlistIdRaw: string): Promise<PlaylistBrowse | null> {
  return fetchPlaylistBrowse(playlistIdRaw);
}
