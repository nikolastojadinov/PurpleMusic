import { CONSENT_COOKIES, fetchInnertubeConfig, type InnertubeConfig } from "./youtubeInnertubeConfig";
import { parseArtistBrowseFromInnertube, type ArtistBrowse } from "./ytmArtistParser";
import { recordInnertubePayload } from "./innertubeRawStore";
import { getSupabaseAdmin } from "./supabaseClient";
import { fetchBrowseWithContinuations } from "../ytmusic/innertubeClient";

export type { ArtistBrowse } from "./ytmArtistParser";

const YTM_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DEBUG = process.env.YTM_DEBUG === "1";
const BROWSE_DEBUG = DEBUG || process.env.YTM_PLAYLIST_DEBUG === "1";

type SuggestionType = "artist" | "track" | "album" | "playlist";

export type MusicSearchSuggestion = {
  type: SuggestionType;
  id: string;
  name: string;
  subtitle?: string;
  imageUrl?: string;
};

export type MusicSearchTrack = {
  id: string;
  title: string;
  artist: string;
  youtubeId: string;
  imageUrl?: string;
};

export type MusicSearchArtist = {
  id: string;
  name: string;
  imageUrl?: string;
  isOfficial?: boolean;
  pageType?: string;
};

export type MusicSearchAlbum = {
  id: string;
  title: string;
  channelId?: string | null;
  channelTitle?: string | null;
  imageUrl?: string;
};

export type MusicSearchPlaylist = {
  id: string;
  title: string;
  channelId?: string | null;
  channelTitle?: string | null;
  imageUrl?: string;
};

export type MusicSearchSection = {
  kind: string;
  title?: string | null;
  items: Array<MusicSearchTrack | MusicSearchArtist | MusicSearchAlbum | MusicSearchPlaylist>;
};

export type OrderedSearchItem = {
  type: SuggestionType;
  data: MusicSearchArtist | MusicSearchTrack | MusicSearchAlbum | MusicSearchPlaylist;
};

export type MusicSearchResults = {
  tracks: MusicSearchTrack[];
  artists: MusicSearchArtist[];
  albums: MusicSearchAlbum[];
  playlists: MusicSearchPlaylist[];
  sections: MusicSearchSection[];
  orderedItems: OrderedSearchItem[];
  refinements: string[];
  suggestions: MusicSearchSuggestion[];
};

export type PlaylistBrowse = {
  playlistId: string;
  title: string;
  subtitle: string;
  thumbnailUrl: string | null;
  tracks: Array<{
    videoId: string;
    title: string;
    artist: string;
    artists?: Array<{ name: string; channelId?: string | null }>;
    duration?: string | null;
    thumbnail?: string | null;
    shortBylineText?: any;
  }>;
};

type ParsedItem = {
  kind: SuggestionType;
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  pageType?: string;
  isOfficialArtist?: boolean;
};

function emptySections(): MusicSearchSection[] {
  return [
    { kind: "songs", title: null, items: [] },
    { kind: "artists", title: null, items: [] },
    { kind: "albums", title: null, items: [] },
    { kind: "playlists", title: null, items: [] },
  ];
}

function sectionKindToSuggestionType(kind: string): SuggestionType | null {
  if (kind === "songs") return "track";
  if (kind === "artists") return "artist";
  if (kind === "albums") return "album";
  if (kind === "playlists") return "playlist";
  return null;
}

function inferOrderedItemType(item: MusicSearchSection["items"][number]): SuggestionType {
  if ((item as MusicSearchTrack).youtubeId) return "track";
  if ((item as MusicSearchArtist).name && !(item as any).title) return "artist";
  if ((item as MusicSearchAlbum).channelTitle || (item as MusicSearchAlbum).channelId) return "album";
  return "playlist";
}

const DEFAULT_RESULTS: MusicSearchResults = {
  tracks: [],
  artists: [],
  albums: [],
  playlists: [],
  sections: emptySections(),
  orderedItems: [],
  refinements: [],
  suggestions: [],
};

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function looksLikeVideoId(value: string): boolean {
  const v = normalizeString(value);
  return /^[A-Za-z0-9_-]{11}$/.test(v);
}

function looksLikeBrowseId(value: string): boolean {
  const v = normalizeString(value);
  if (!v || v.includes(" ")) return false;
  return /^(OLAK|PL|VL|RD|MP|UU|LL|UC|OL|RV)[A-Za-z0-9_-]+$/i.test(v);
}

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function isMusicPageType(pageType: unknown, match: string): boolean {
  return typeof pageType === "string" && pageType.includes(match);
}

function pickText(node: any): string {
  const runs = node?.runs;
  if (Array.isArray(runs) && runs.length > 0) {
    return normalizeString(runs.map((r: any) => r?.text ?? "").join(""));
  }
  const simple = node?.simpleText;
  return normalizeString(simple);
}

function pickRunsText(runs: any): string {
  if (!Array.isArray(runs) || runs.length === 0) return "";
  return normalizeString(runs.map((r: any) => r?.text ?? "").join(""));
}

function pickThumbnail(thumbnails?: any): string | null {
  const arr = Array.isArray(thumbnails) ? thumbnails : thumbnails?.thumbnails;
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const scored = arr
    .map((t: any) => {
      const url = normalizeString(t?.url);
      const width = Number(t?.width) || 0;
      const height = Number(t?.height) || 0;
      const area = width > 0 && height > 0 ? width * height : width || height;
      return url ? { url, score: area } : null;
    })
    .filter(Boolean) as Array<{ url: string; score: number }>;

  if (scored.length === 0) return null;

  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

function logDebug(label: string, payload: unknown): void {
  if (!DEBUG) return;
  try {
    console.log(`[YTM][debug] ${label}`, payload ?? {});
  } catch {
    // ignore
  }
}

function buildSearchBody(config: InnertubeConfig, query: string): any {
  return {
    context: {
      client: {
        clientName: config.clientName,
        clientVersion: config.clientVersion,
        hl: "en",
        gl: "US",
        platform: "DESKTOP",
        visitorData: config.visitorData,
        userAgent: YTM_USER_AGENT,
        utcOffsetMinutes: 0,
      },
      user: { enableSafetyMode: false },
      request: {
        internalExperimentFlags: [],
        sessionIndex: 0,
      },
    },
    query,
  };
}

function resolveApiBase(config: InnertubeConfig): string {
  return config.apiBase.endsWith("/") ? config.apiBase : `${config.apiBase}/`;
}

async function loadConfigOrThrow(): Promise<InnertubeConfig> {
  try {
    return await fetchInnertubeConfig();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Innertube][config] ${message}`);
    throw err instanceof Error ? err : new Error(message);
  }
}

async function callYoutubei<T = any>(config: InnertubeConfig, path: string, payload: Record<string, any>): Promise<T> {
  const base = resolveApiBase(config);
  const url = `${base}${path}?prettyPrint=false&key=${encodeURIComponent(config.apiKey)}`;

  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": YTM_USER_AGENT,
    Origin: "https://music.youtube.com",
    Referer: "https://music.youtube.com/search",
    Cookie: CONSENT_COOKIES,
    "X-Goog-Visitor-Id": config.visitorData,
    "X-YouTube-Client-Name": "67",
    "X-YouTube-Client-Version": config.clientVersion,
  } as const;

  try {
    console.log("[debug][innertube_request]", {
      url,
      headers,
      context: payload?.context,
    });
  } catch {
    // ignore logging issues
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Innertube request failed: ${response.status}`);
  }

  const json = (await response.json()) as T;
  return json;
}

async function recordPlaylistRawBrowse(browseId: string, raw: any): Promise<void> {
  const hasPlaylistContents = (payload: any): boolean => {
    if (!payload || typeof payload !== "object") return false;
    const stack: any[] = [payload];
    const seen = new WeakSet<object>();
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object") continue;
      if (seen.has(node as object)) continue;
      seen.add(node as object);

      const shelf = (node as any).musicPlaylistShelfRenderer;
      if (shelf && Array.isArray(shelf.contents) && shelf.contents.length) return true;

      for (const value of Object.values(node)) stack.push(value);
    }
    return false;
  };

  if (!hasPlaylistContents(raw)) {
    return;
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("ingest_requests").insert({
      source: "playlist",
      status: "raw",
      payload: { browseId, raw },
    });

    if (error) {
      console.error("[playlist-raw][insert_failed]", { browseId, message: error.message });
    }
  } catch (err: any) {
    console.error("[playlist-raw][unexpected_error]", { browseId, message: err?.message ?? String(err) });
  }
}

function extractNavigation(renderer: any): { browseId: string; pageType: string; videoId: string } {
  const navigation =
    renderer?.navigationEndpoint ||
    renderer?.playNavigationEndpoint ||
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint ||
    renderer?.menu?.navigationItemRenderer?.navigationEndpoint;

  const browseEndpoint = navigation?.browseEndpoint || renderer?.browseEndpoint;
  const watchEndpoint = navigation?.watchEndpoint || renderer?.watchEndpoint;
  const browseId = normalizeString(browseEndpoint?.browseId);
  const pageType = normalizeString(
    browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType
  );
  const videoId = normalizeString(watchEndpoint?.videoId);

  return { browseId, pageType, videoId };
}

function findFirstWatchVideoId(node: any, visited: WeakSet<object>): string {
  if (!node) return "";
  if (typeof node !== "object") return "";
  if (visited.has(node)) return "";
  visited.add(node);

  const directPlayNav = normalizeString((node as any)?.playNavigationEndpoint?.watchEndpoint?.videoId);
  if (looksLikeVideoId(directPlayNav)) return directPlayNav;

  const direct = normalizeString((node as any)?.watchEndpoint?.videoId);
  if (looksLikeVideoId(direct)) return direct;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findFirstWatchVideoId(item, visited);
      if (found) return found;
    }
    return "";
  }

  for (const value of Object.values(node)) {
    const found = findFirstWatchVideoId(value as any, visited);
    if (found) return found;
  }
  return "";
}

function extractVideoIdFromResponsive(renderer: any): string {
  const overlayNav =
    renderer?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint;
  const navigation = overlayNav || renderer?.navigationEndpoint || renderer?.playNavigationEndpoint;
  const watchVideoId = normalizeString(navigation?.watchEndpoint?.videoId);
  if (looksLikeVideoId(watchVideoId)) return watchVideoId;

  const playlistDataId = normalizeString(renderer?.playlistItemData?.videoId);
  if (looksLikeVideoId(playlistDataId)) return playlistDataId;

  const directId = normalizeString(renderer?.watchEndpoint?.videoId || renderer?.videoId);
  if (looksLikeVideoId(directId)) return directId;

  const menu = renderer?.menu;
  if (menu && typeof menu === "object") {
    const visited = new WeakSet<object>();
    const found = findFirstWatchVideoId(menu, visited);
    if (looksLikeVideoId(found)) return found;
  }

  return "";
}

function parsedToEntity(parsed: ParsedItem): MusicSearchTrack | MusicSearchArtist | MusicSearchAlbum | MusicSearchPlaylist {
  if (parsed.kind === "track") {
    return {
      id: parsed.id,
      title: parsed.title,
      artist: parsed.subtitle || "",
      youtubeId: parsed.id,
      imageUrl: parsed.imageUrl,
    } satisfies MusicSearchTrack;
  }

  if (parsed.kind === "artist") {
    return {
      id: parsed.id,
      name: parsed.title,
      imageUrl: parsed.imageUrl,
      isOfficial: Boolean(parsed.isOfficialArtist),
      pageType: parsed.pageType,
    } satisfies MusicSearchArtist;
  }

  if (parsed.kind === "album") {
    return {
      id: parsed.id,
      title: parsed.title,
      channelId: null,
      channelTitle: parsed.subtitle || null,
      imageUrl: parsed.imageUrl,
    } satisfies MusicSearchAlbum;
  }

  return {
    id: parsed.id,
    title: parsed.title,
    channelId: null,
    channelTitle: parsed.subtitle || null,
    imageUrl: parsed.imageUrl,
  } satisfies MusicSearchPlaylist;
}

function parseMusicResponsiveListItemRenderer(renderer: any): ParsedItem | null {
  const title =
    pickRunsText(renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs) ||
    pickText(renderer?.title) ||
    "";
  const subtitle = pickRunsText(renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
  const thumb = pickThumbnail(renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails);

  const videoId = extractVideoIdFromResponsive(renderer);
  if (looksLikeVideoId(videoId) && title) {
    return { kind: "track", id: videoId, title, subtitle: subtitle || undefined, imageUrl: thumb || undefined };
  }

  const { browseId, pageType } = extractNavigation(renderer);
  if (!browseId) return null;

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_ARTIST") && (title || subtitle)) {
    return {
      kind: "artist",
      id: browseId,
      title: title || subtitle || browseId,
      subtitle: subtitle || undefined,
      imageUrl: thumb || undefined,
      pageType,
      isOfficialArtist: browseId.startsWith("UC"),
    };
  }

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_ALBUM") && title) {
    return { kind: "album", id: browseId, title, subtitle: subtitle || undefined, imageUrl: thumb || undefined };
  }

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_PLAYLIST") && title) {
    return { kind: "playlist", id: browseId, title, subtitle: subtitle || undefined, imageUrl: thumb || undefined };
  }

  return null;
}

function parseMusicTwoRowItemRenderer(renderer: any): ParsedItem | null {
  const title = pickText(renderer?.title) || "";
  const subtitle = pickText(renderer?.subtitle) || "";
  const thumb = pickThumbnail(renderer?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails);

  const browseEndpoint = renderer?.navigationEndpoint?.browseEndpoint;
  const pageType = browseEndpoint?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;
  const browseId = normalizeString(browseEndpoint?.browseId);
  if (!browseId || !title) return null;

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_ALBUM")) {
    return { kind: "album", id: browseId, title, subtitle: subtitle || undefined, imageUrl: thumb || undefined };
  }

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_PLAYLIST")) {
    return { kind: "playlist", id: browseId, title, subtitle: subtitle || undefined, imageUrl: thumb || undefined };
  }

  if (isMusicPageType(pageType, "MUSIC_PAGE_TYPE_ARTIST")) {
    return {
      kind: "artist",
      id: browseId,
      title: title || subtitle || browseId,
      subtitle: subtitle || undefined,
      imageUrl: thumb || undefined,
      pageType,
      isOfficialArtist: browseId.startsWith("UC"),
    };
  }

  return null;
}

function inferKind(parsedItems: ParsedItem[]): string {
  const variantSet = new Set(parsedItems.map((p) => p.kind));
  if (variantSet.has("track")) return "songs";
  if (variantSet.has("artist")) return "artists";
  if (variantSet.has("album")) return "albums";
  if (variantSet.has("playlist")) return "playlists";
  return "unknown";
}

function parseShelfRenderer(shelf: any): { section: MusicSearchSection | null; collected: ParsedItem[] } {
  const contents = Array.isArray(shelf?.contents) ? shelf.contents : [];
  const parsedItems: ParsedItem[] = [];

  contents.forEach((content: any) => {
    const renderer = content?.musicResponsiveListItemRenderer;
    if (!renderer) return;
    const parsed = parseMusicResponsiveListItemRenderer(renderer);
    if (parsed) parsedItems.push(parsed);
  });

  if (parsedItems.length === 0) return { section: null, collected: [] };

  const section: MusicSearchSection = {
    kind: inferKind(parsedItems),
    title: pickText(shelf?.title) || null,
    items: parsedItems.map(parsedToEntity),
  };

  return { section, collected: parsedItems };
}

function parseCarouselRenderer(carousel: any): { section: MusicSearchSection | null; collected: ParsedItem[] } {
  const cards = Array.isArray(carousel?.contents) ? carousel.contents : [];
  const parsedItems: ParsedItem[] = [];

  cards.forEach((card: any) => {
    const renderer = card?.musicTwoRowItemRenderer;
    if (!renderer) return;
    const parsed = parseMusicTwoRowItemRenderer(renderer);
    if (parsed) parsedItems.push(parsed);
  });

  if (parsedItems.length === 0) return { section: null, collected: [] };

  const section: MusicSearchSection = {
    kind: inferKind(parsedItems),
    title:
      pickText(carousel?.header?.musicCarouselShelfBasicHeaderRenderer?.title) ||
      pickText(carousel?.header?.musicCarouselShelfRenderer?.title) ||
      null,
    items: parsedItems.map(parsedToEntity),
  };

  return { section, collected: parsedItems };
}

function parseCardShelfRenderer(cardShelf: any): { section: MusicSearchSection | null; collected: ParsedItem[] } {
  const contents = Array.isArray(cardShelf?.contents) ? cardShelf.contents : [];
  const parsedItems: ParsedItem[] = [];

  contents.forEach((content: any) => {
    const twoRow = content?.musicTwoRowItemRenderer;
    if (twoRow) {
      const parsed = parseMusicTwoRowItemRenderer(twoRow);
      if (parsed) parsedItems.push(parsed);
    }
  });

  if (parsedItems.length === 0) return { section: null, collected: [] };

  const section: MusicSearchSection = {
    kind: inferKind(parsedItems),
    title: pickText(cardShelf?.header?.title) || null,
    items: parsedItems.map(parsedToEntity),
  };

  return { section, collected: parsedItems };
}

function parseSearchNode(node: any, sections: MusicSearchSection[], collected: ParsedItem[]): void {
  if (!node) return;

  if (node.musicShelfRenderer) {
    const parsed = parseShelfRenderer(node.musicShelfRenderer);
    if (parsed.section) sections.push(parsed.section);
    collected.push(...parsed.collected);
  }

  if (node.musicCarouselShelfRenderer) {
    const parsed = parseCarouselRenderer(node.musicCarouselShelfRenderer);
    if (parsed.section) sections.push(parsed.section);
    collected.push(...parsed.collected);
  }

  if (node.musicCardShelfRenderer) {
    const parsed = parseCardShelfRenderer(node.musicCardShelfRenderer);
    if (parsed.section) sections.push(parsed.section);
    collected.push(...parsed.collected);
  }

  const responsive = node.musicResponsiveListItemRenderer;
  if (responsive) {
    const parsed = parseMusicResponsiveListItemRenderer(responsive);
    if (parsed) {
      collected.push(parsed);
      sections.push({ kind: inferKind([parsed]), title: null, items: [parsedToEntity(parsed)] });
    }
  }

  const twoRow = node.musicTwoRowItemRenderer;
  if (twoRow) {
    const parsed = parseMusicTwoRowItemRenderer(twoRow);
    if (parsed) {
      collected.push(parsed);
      sections.push({ kind: inferKind([parsed]), title: null, items: [parsedToEntity(parsed)] });
    }
  }

  const inner = node.itemSectionRenderer?.contents;
  if (Array.isArray(inner)) {
    inner.forEach((content: any) => parseSearchNode(content, sections, collected));
  }
}

function extractSearchSections(root: any): { sections: MusicSearchSection[]; collected: ParsedItem[] } {
  const sections: MusicSearchSection[] = [];
  const collected: ParsedItem[] = [];

  const tabs = root?.contents?.tabbedSearchResultsRenderer?.tabs || [];
  tabs.forEach((tab: any, tabIndex: number) => {
    const tabRenderer = tab?.tabRenderer;
    const tabContent = tabRenderer?.content;
    const sectionList = tabContent?.sectionListRenderer;
    const sectionContents = sectionList?.contents || [];
    logDebug("tab_keys", { tabIndex, keys: Object.keys(tabRenderer || {}) });

    sectionContents.forEach((section: any, sectionIndex: number) => {
      logDebug("section_keys", { tabIndex, sectionIndex, keys: Object.keys(section || {}) });
      parseSearchNode(section, sections, collected);
    });
  });

  return { sections, collected };
}

function partitionParsedItems(items: ParsedItem[]): MusicSearchResults {
  const tracks: MusicSearchTrack[] = [];
  const artists: MusicSearchArtist[] = [];
  const albums: MusicSearchAlbum[] = [];
  const playlists: MusicSearchPlaylist[] = [];

  const artistMap = new Map<string, MusicSearchArtist>();

  const seen = {
    track: new Set<string>(),
    artist: new Set<string>(),
    album: new Set<string>(),
    playlist: new Set<string>(),
  };

  items.forEach((parsed) => {
    const id = normalizeString(parsed.id);
    if (!id) return;

    if (parsed.kind === "track") {
      if (seen.track.has(id)) return;
      seen.track.add(id);
      tracks.push(parsedToEntity(parsed) as MusicSearchTrack);
      return;
    }

    if (parsed.kind === "artist") {
      const next = parsedToEntity(parsed) as MusicSearchArtist;
      const existing = artistMap.get(id);
      if (existing) {
        existing.isOfficial = existing.isOfficial || next.isOfficial;
        existing.pageType = existing.pageType || next.pageType;
        return;
      }
      artistMap.set(id, next);
      seen.artist.add(id);
      artists.push(next);
      return;
    }

    if (parsed.kind === "album") {
      if (seen.album.has(id)) return;
      seen.album.add(id);
      albums.push(parsedToEntity(parsed) as MusicSearchAlbum);
      return;
    }

    if (parsed.kind === "playlist") {
      if (seen.playlist.has(id)) return;
      seen.playlist.add(id);
      playlists.push(parsedToEntity(parsed) as MusicSearchPlaylist);
    }
  });

  return {
    tracks,
    artists,
    albums,
    playlists,
    sections: [],
    orderedItems: [],
    refinements: [],
    suggestions: [],
  };
}

function isLikelyNonMusicArtist(pageType: string): boolean {
  const lower = normalizeString(pageType).toLowerCase();
  if (!lower) return false;
  return lower.includes("podcast") || lower.includes("episode") || lower.includes("show") || lower.includes("program");
}

async function validateArtistHasMusicContent(browseId: string, config: InnertubeConfig): Promise<boolean> {
  if (!looksLikeBrowseId(browseId)) return false;

  try {
    const browseJson = await callYoutubei<any>(config, "browse", {
      context: buildSearchBody(config, "").context,
      browseId,
    });

    const parsed = parseArtistBrowseFromInnertube(browseJson, browseId);
    const hasTopSongs = Array.isArray(parsed?.topSongs) && parsed.topSongs.length > 0;
    const hasAlbums = Array.isArray(parsed?.albums) && parsed.albums.length > 0;
    const hasPlaylists = Array.isArray(parsed?.playlists) && parsed.playlists.length > 0;
    const hasArtistLayout = Array.isArray(browseJson?.contents?.singleColumnBrowseResultsRenderer?.tabs);

    return hasTopSongs || hasAlbums || hasPlaylists || hasArtistLayout;
  } catch (err) {
    logDebug("artist_validate_error", err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function sanitizeArtistsList(artists: MusicSearchArtist[], config: InnertubeConfig): Promise<MusicSearchArtist[]> {
  const valid: MusicSearchArtist[] = [];

  for (const artist of toArray<MusicSearchArtist>(artists)) {
    const pageType = normalizeString(artist.pageType);
    if (isLikelyNonMusicArtist(pageType)) continue;

    if (artist.isOfficial) {
      valid.push({ ...artist, isOfficial: true, pageType });
      continue;
    }

    const hasMusic = await validateArtistHasMusicContent(artist.id, config);
    if (hasMusic) {
      valid.push({ ...artist, isOfficial: Boolean(artist.isOfficial), pageType });
    }
  }

  return valid;
}

function buildCanonicalSections(
  artists: MusicSearchArtist[],
  tracks: MusicSearchTrack[],
  albums: MusicSearchAlbum[],
  playlists: MusicSearchPlaylist[]
): MusicSearchSection[] {
  return [
    { kind: "artists", title: null, items: artists },
    { kind: "songs", title: null, items: tracks },
    { kind: "albums", title: null, items: albums },
    { kind: "playlists", title: null, items: playlists },
  ];
}

function buildPrioritizedOrderedItems(
  query: string,
  artists: MusicSearchArtist[],
  tracks: MusicSearchTrack[],
  albums: MusicSearchAlbum[],
  playlists: MusicSearchPlaylist[]
): OrderedSearchItem[] {
  const normalizedQuery = normalizeString(query).toLowerCase();

  const exactOfficial = artists.filter(
    (artist) => artist.isOfficial && normalizeString(artist.name).toLowerCase() === normalizedQuery
  );
  const otherOfficial = artists.filter(
    (artist) => artist.isOfficial && !exactOfficial.some((existing) => existing.id === artist.id)
  );
  const remainingArtists = artists.filter((artist) => !artist.isOfficial);

  const ordered: OrderedSearchItem[] = [];
  const pushArtists = (list: MusicSearchArtist[]) => {
    list.forEach((artist) => ordered.push({ type: "artist", data: artist }));
  };

  pushArtists(exactOfficial);
  pushArtists(otherOfficial);
  pushArtists(remainingArtists);

  tracks.forEach((track) => ordered.push({ type: "track", data: track }));
  albums.forEach((album) => ordered.push({ type: "album", data: album }));
  playlists.forEach((playlist) => ordered.push({ type: "playlist", data: playlist }));

  return ordered;
}

const MAX_SUGGESTIONS_TOTAL = 20;

function buildSuggestionsFromPartition(partitioned: MusicSearchResults): MusicSearchSuggestion[] {
  const suggestions: MusicSearchSuggestion[] = [];
  const seen = new Set<string>();

  const push = (item: MusicSearchSuggestion) => {
    const id = normalizeString(item.id);
    const name = normalizeString(item.name);
    if (!id || !name) return;
    const key = `${item.type}:${id}`;
    if (seen.has(key)) return;
    seen.add(key);
    suggestions.push({ ...item, id, name });
  };

  const artists = toArray<MusicSearchArtist>(partitioned.artists);
  for (const artist of artists) {
    push({
      type: "artist",
      id: artist.id,
      name: artist.name,
      subtitle: "Artist",
      imageUrl: normalizeString(artist.imageUrl) || undefined,
    });
    if (suggestions.length >= MAX_SUGGESTIONS_TOTAL) return suggestions;
  }

  const tracks = toArray<MusicSearchTrack>(partitioned.tracks);
  for (const track of tracks) {
    push({
      type: "track",
      id: track.youtubeId,
      name: track.title,
      subtitle: normalizeString(track.artist) || undefined,
      imageUrl: normalizeString(track.imageUrl) || undefined,
    });
    if (suggestions.length >= MAX_SUGGESTIONS_TOTAL) return suggestions;
  }

  const albums = toArray<MusicSearchAlbum>(partitioned.albums);
  for (const album of albums) {
    push({
      type: "album",
      id: album.id,
      name: album.title,
      subtitle: "Album",
      imageUrl: normalizeString(album.imageUrl) || undefined,
    });
    if (suggestions.length >= MAX_SUGGESTIONS_TOTAL) return suggestions;
  }

  const playlists = toArray<MusicSearchPlaylist>(partitioned.playlists);
  for (const playlist of playlists) {
    push({
      type: "playlist",
      id: playlist.id,
      name: playlist.title,
      subtitle: "Playlist",
      imageUrl: normalizeString(playlist.imageUrl) || undefined,
    });
    if (suggestions.length >= MAX_SUGGESTIONS_TOTAL) return suggestions;
  }

  return suggestions.slice(0, MAX_SUGGESTIONS_TOTAL);
}

export async function searchSuggestions(queryRaw: string): Promise<MusicSearchSuggestion[]> {
  const query = normalizeString(queryRaw);
  if (!query) return [];

  try {
    const config = await loadConfigOrThrow();
    const payload = buildSearchBody(config, query);
    const json = await callYoutubei<any>(config, "search", payload);
    const { collected } = extractSearchSections(json);
    const partitioned = partitionParsedItems(collected);
    return buildSuggestionsFromPartition(partitioned);
  } catch (err) {
    logDebug("searchSuggestions_error", err instanceof Error ? err.message : String(err));
    return [];
  }
}

export async function musicSearch(queryRaw: string): Promise<MusicSearchResults> {
  const query = normalizeString(queryRaw);
  if (!query) {
    return { ...DEFAULT_RESULTS, sections: emptySections() };
  }

  try {
    const config = await loadConfigOrThrow();
    const payload = buildSearchBody(config, query);
    const json = await callYoutubei<any>(config, "search", payload);

    const refinements: string[] = Array.isArray((json as any)?.refinements)
      ? (json as any).refinements.map((s: any) => String(s))
      : [];

    const { collected } = extractSearchSections(json);
    const partitioned = partitionParsedItems(collected);

    const tracks = Array.isArray(partitioned.tracks) ? partitioned.tracks : [];
    // IMPORTANT: do NOT sanitize artists here â YT Music search already returns valid music artists
    const artists = Array.isArray(partitioned.artists) ? partitioned.artists : [];
    const albums = Array.isArray(partitioned.albums) ? partitioned.albums : [];
    const playlists = Array.isArray(partitioned.playlists) ? partitioned.playlists : [];

    const sections = buildCanonicalSections(artists, tracks, albums, playlists);
    const orderedItems = buildPrioritizedOrderedItems(query, artists, tracks, albums, playlists);

    return {
      tracks,
      artists,
      albums,
      playlists,
      sections,
      orderedItems,
      refinements,
      suggestions: [],
    };
  } catch (err) {
    logDebug("musicSearch_error", err instanceof Error ? err.message : String(err));
    return { ...DEFAULT_RESULTS, sections: emptySections() };
  }
}

export async function musicSearchRaw(queryRaw: string): Promise<any> {
  const query = normalizeString(queryRaw);
  if (!query) return {};

  try {
    const config = await loadConfigOrThrow();
    const payload = buildSearchBody(config, query);
    const json = await callYoutubei<any>(config, "search", payload);
    return json;
  } catch (err) {
    logDebug("musicSearchRaw_error", err instanceof Error ? err.message : String(err));
    return {};
  }
}

export async function browseArtistById(browseIdRaw: string): Promise<ArtistBrowse | null> {
  const browseId = normalizeString(browseIdRaw);
  if (!browseId) return null;

  const config = await fetchInnertubeConfig();
  if (!config) return null;

  const browseJson = await callYoutubei<any>(config, "browse", {
    context: buildSearchBody(config, "").context,
    browseId,
  });
  if (!browseJson) return null;

  void recordInnertubePayload("artist", browseId, browseJson);

  const result = parseArtistBrowseFromInnertube(browseJson, browseId);

  console.info("[browse/artist] parsed", {
    browseId,
    topSongs: result.topSongs.length,
    albums: result.albums.length,
    playlists: result.playlists.length,
  });

  return result;
}

function extractArtistNamesFromRuns(
  runs: Array<{ text?: string }>
): string[] {
  if (!Array.isArray(runs)) return [];

  return runs
    .map((r) => (r?.text ?? "").trim())
    .filter(
      (t) =>
        t.length > 0 &&
        t !== "•" &&
        t !== "," &&
        t !== "&" &&
        t !== "–"
    );
}

function collectTrackRenderersFromSections(sectionContents: any[]): any[] {
  const renderers: any[] = [];
  sectionContents.forEach((content: any) => {
    if (content?.musicResponsiveListItemRenderer) renderers.push(content.musicResponsiveListItemRenderer);

    const playlistShelf = content?.musicPlaylistShelfRenderer?.contents;
    if (Array.isArray(playlistShelf)) {
      playlistShelf.forEach((item: any) => {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (renderer) renderers.push(renderer);
      });
    }

    const musicShelf = content?.musicShelfRenderer?.contents;
    if (Array.isArray(musicShelf)) {
      musicShelf.forEach((item: any) => {
        const renderer = item?.musicResponsiveListItemRenderer;
        if (renderer) renderers.push(renderer);
      });
    }
  });
  return renderers;
}

function collectPlaylistTrackRenderers(browseJson: any): any[] {
  const secondary =
    browseJson?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents ?? [];

  const renderers = collectTrackRenderersFromSections(secondary);

  const continuationContents = browseJson?.continuationContents?.musicPlaylistShelfContinuation?.contents ?? [];
  continuationContents.forEach((item: any) => {
    const renderer = item?.musicResponsiveListItemRenderer;
    if (renderer) renderers.push(renderer);
  });

  return renderers;
}

function collectAlbumTrackRenderers(browseJson: any): any[] {
  const tabs = browseJson?.contents?.twoColumnBrowseResultsRenderer?.tabs ?? [];
  const primaryTabSections = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
  const secondarySections = browseJson?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents ?? [];

  const renderers = [...collectTrackRenderersFromSections(primaryTabSections), ...collectTrackRenderersFromSections(secondarySections)];

  const continuationShelf = browseJson?.continuationContents?.musicShelfContinuation?.contents ?? [];
  continuationShelf.forEach((item: any) => {
    const renderer = item?.musicResponsiveListItemRenderer;
    if (renderer) renderers.push(renderer);
  });

  return renderers;
}

function parseTrackRenderer(renderer: any): PlaylistBrowse["tracks"][number] | null {
  const videoId = extractVideoIdFromResponsive(renderer);
  if (!looksLikeVideoId(videoId)) return null;

  const title = pickRunsText(renderer?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs);
  if (!title) return null;

  const artistRuns = renderer?.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
  const artistNames = extractArtistNamesFromRuns(artistRuns);
  if (!artistNames.length) return null;

  const duration =
    pickRunsText(renderer?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs) || null;

  const thumbnail =
    pickThumbnail(renderer?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) ||
    pickThumbnail(renderer?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails) ||
    null;

  return {
    videoId,
    title,
    artist: artistNames[0] || "",
    artists: artistNames.map((name) => ({ name, channelId: null })),
    duration,
    thumbnail,
    shortBylineText: renderer?.shortBylineText,
  };
}

function parsePlaylistBrowseTracks(browseJson: any, browseId: string): PlaylistBrowse["tracks"] {
  const renderers = collectPlaylistTrackRenderers(browseJson);
  const tracks: PlaylistBrowse["tracks"] = [];
  const seen = new Set<string>();

  renderers.forEach((renderer: any, index: number) => {
    const parsed = parseTrackRenderer(renderer);
    if (!parsed) return;
    if (seen.has(parsed.videoId)) return;
    seen.add(parsed.videoId);
    tracks.push(parsed);
  });

  if (BROWSE_DEBUG) {
    console.info("[browse/playlist][debug] extraction_summary", {
      browseId,
      itemCount: renderers.length,
      trackCount: tracks.length,
    });
  }

  console.info("[browse/playlist] parsed", {
    browseId,
    title: pickText(browseJson?.header?.musicDetailHeaderRenderer?.title) || browseId,
    count: tracks.length,
    sources: ["musicResponsiveListItemRenderer"],
  });

  return tracks;
}

function parseAlbumBrowseTracks(browseJson: any, browseId: string): PlaylistBrowse["tracks"] {
  const renderers = collectAlbumTrackRenderers(browseJson);
  const tracks: PlaylistBrowse["tracks"] = [];
  const seen = new Set<string>();

  renderers.forEach((renderer: any) => {
    const parsed = parseTrackRenderer(renderer);
    if (!parsed) return;
    if (seen.has(parsed.videoId)) return;
    seen.add(parsed.videoId);
    tracks.push(parsed);
  });

  if (BROWSE_DEBUG) {
    console.info("[browse/album][debug] extraction_summary", {
      browseId,
      itemCount: renderers.length,
      trackCount: tracks.length,
    });
  }

  return tracks;
}

export async function browsePlaylistById(playlistIdRaw: string): Promise<PlaylistBrowse | null> {
  const playlistId = normalizeString(playlistIdRaw);
  if (!playlistId) return null;

  const upper = playlistId.toUpperCase();
  const browseId = upper.startsWith("VL") || upper.startsWith("MPRE") || upper.startsWith("OLAK") ? playlistId : `VL${playlistId}`;

  const browseJson = await fetchBrowseWithContinuations(browseId, { logRaw: true });

  if (!browseJson) return null;

  const header = browseJson?.header?.musicDetailHeaderRenderer;
  const title = pickText(header?.title) || playlistId;
  const subtitle = pickRunsText(header?.secondSubtitle?.runs) || "";
  const thumbnailUrl =
    pickThumbnail(header?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails) ||
    pickThumbnail(header?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails) ||
    pickThumbnail(browseJson?.background?.musicThumbnailRenderer?.thumbnail?.thumbnails) ||
    null;

  const tracks = parsePlaylistBrowseTracks(browseJson, browseId);

  return { playlistId, title, subtitle, thumbnailUrl, tracks };
}
