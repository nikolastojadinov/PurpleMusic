import { Innertube, UniversalCache } from 'youtubei.js';
import { normalize, toSeconds } from '../ingest/utils';

export type YTMusicTrack = {
  videoId: string;
  title: string;
  artist: string;
  duration: number | null;
  thumbnail: string | null;
};

export type ArtistBrowse = {
  browseId: string;
  name: string;
  description: string | null;
  channelId: string;
  thumbnails: string[];
  topSongs: YTMusicTrack[];
  albums: Array<{ id: string; title: string; year: string | null; thumbnail: string | null; trackCount: number | null }>;
  playlists: Array<{ id: string; title: string; thumbnail: string | null }>;
};

export type AlbumBrowse = {
  browseId: string;
  title: string;
  thumbnail: string | null;
  releaseDate: string | null;
  trackCount: number | null;
  tracks: YTMusicTrack[];
};

export type PlaylistBrowse = {
  browseId: string;
  title: string;
  subtitle: string | null;
  thumbnail: string | null;
  tracks: YTMusicTrack[];
};

let clientPromise: Promise<Innertube> | null = null;

async function getClient(): Promise<Innertube> {
  if (!clientPromise) {
    // youtubei typings do not expose a dedicated YTMUSIC client flag; we rely on defaults and suppress type noise.
    clientPromise = Innertube.create({ cache: new UniversalCache(false) } as any);
  }
  return clientPromise;
}

export async function fetchArtistBrowse(browseIdRaw: string): Promise<ArtistBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  try {
    const client = await getClient();
    const artist: any = await (client as any).music.getArtist(browseId);
    if (!artist) return null;

    const topSongs: YTMusicTrack[] = (artist?.songs?.results || [])
      .map((song: any) => ({
        videoId: normalize(song?.id),
        title: normalize(song?.title) || 'Untitled',
        artist: normalize(song?.artists?.[0]?.name) || normalize(artist?.name) || 'Unknown artist',
        duration: toSeconds(song?.duration_seconds ?? song?.duration),
        thumbnail: song?.thumbnails?.[0]?.url || null,
      }))
      .filter((t: YTMusicTrack) => t.videoId);

    const albums = (artist?.albums?.results || []).map((al: any) => ({
      id: normalize(al?.id),
      title: normalize(al?.title) || 'Album',
      year: normalize(al?.year) || null,
      thumbnail: al?.thumbnails?.[0]?.url || null,
      trackCount: Number.isFinite(al?.song_count) ? Number(al.song_count) : null,
    })).filter((a: any) => a.id);

    const playlists = (artist?.playlists?.results || []).map((pl: any) => ({
      id: normalize(pl?.id),
      title: normalize(pl?.title) || 'Playlist',
      thumbnail: pl?.thumbnails?.[0]?.url || null,
    })).filter((p: any) => p.id);

    return {
      browseId,
      name: normalize((artist as any)?.name) || browseId,
      description: typeof (artist as any)?.description === 'string' ? normalize((artist as any).description) : null,
      channelId: normalize((artist as any)?.channel?.id) || browseId,
      thumbnails: ((artist as any)?.thumbnails || []).map((t: any) => t?.url).filter(Boolean),
      topSongs,
      albums,
      playlists,
    };
  } catch (err: any) {
    console.error('[ytmusic][artist_browse] failed', { browseId, message: err?.message || String(err) });
    return null;
  }
}

export async function fetchAlbumBrowse(browseIdRaw: string): Promise<AlbumBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  try {
    const client = await getClient();
    const album: any = await (client as any).music.getAlbum(browseId);
    if (!album) return null;

    const tracks: YTMusicTrack[] = (album?.tracks || []).map((track: any) => ({
      videoId: normalize(track?.id),
      title: normalize(track?.title) || 'Untitled',
      artist: normalize(track?.artists?.[0]?.name) || normalize((album as any)?.artist) || 'Unknown artist',
      duration: toSeconds(track?.duration_seconds ?? track?.duration),
      thumbnail: track?.thumbnails?.[0]?.url || album?.thumbnails?.[0]?.url || null,
    })).filter((t: YTMusicTrack) => t.videoId);

    return {
      browseId,
      title: normalize((album as any)?.title) || browseId,
      thumbnail: (album as any)?.thumbnails?.[0]?.url || null,
      releaseDate: normalize((album as any)?.year) ? `${normalize((album as any).year)}-01-01` : null,
      trackCount: Number.isFinite((album as any)?.song_count) ? Number((album as any).song_count) : tracks.length,
      tracks,
    };
  } catch (err: any) {
    console.error('[ytmusic][album_browse] failed', { browseId, message: err?.message || String(err) });
    return null;
  }
}

export async function fetchPlaylistBrowse(browseIdRaw: string): Promise<PlaylistBrowse | null> {
  const browseId = normalize(browseIdRaw);
  if (!browseId) return null;
  try {
    const client = await getClient();
    const playlist: any = await (client as any).music.getPlaylist(browseId);
    if (!playlist) return null;

    const tracks: YTMusicTrack[] = (playlist?.videos || []).map((track: any) => ({
      videoId: normalize(track?.id),
      title: normalize(track?.title) || 'Untitled',
      artist: normalize(track?.artists?.[0]?.name) || normalize((playlist as any)?.author?.name) || 'Unknown artist',
      duration: toSeconds(track?.duration_seconds ?? track?.duration),
      thumbnail: track?.thumbnails?.[0]?.url || playlist?.thumbnails?.[0]?.url || null,
    })).filter((t: YTMusicTrack) => t.videoId);

    return {
      browseId,
      title: normalize((playlist as any)?.title) || browseId,
      subtitle: normalize((playlist as any)?.author?.name) || null,
      thumbnail: (playlist as any)?.thumbnails?.[0]?.url || null,
      tracks,
    };
  } catch (err: any) {
    console.error('[ytmusic][playlist_browse] failed', { browseId, message: err?.message || String(err) });
    return null;
  }
}
