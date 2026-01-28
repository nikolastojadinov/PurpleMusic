// PORTED FROM legacy hajde-music-stream:
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/ytmArtistParser.ts
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/youtubeMusicClient.ts
// function(s): parseArtistBrowseFromInnertube, pickThumbnail
import { normalize, toSeconds, upsertAlbums, upsertPlaylists, type AlbumInput, type PlaylistInput, type TrackInput, type IdMap } from '../utils';
import type { ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase2Output = {
  artistId: string;
  artistKey: string;
  browseId: string;
  albums: AlbumInput[];
  playlists: PlaylistInput[];
  topSongs: TrackInput[];
  albumIdMap: IdMap;
  playlistIdMap: IdMap;
  albumExternalIds: string[];
  playlistExternalIds: string[];
};

type RawAlbum = ArtistBrowse['albums'][number];
type RawPlaylist = ArtistBrowse['playlists'][number];
type RawTopSong = ArtistBrowse['topSongs'][number];

function pickBestThumbnail(thumbnails?: any): string | null {
  const arr = Array.isArray(thumbnails) ? thumbnails : thumbnails?.thumbnails;
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const scored = arr
    .map((t: any) => {
      const url = normalize(t?.url);
      if (!url) return null;
      const w = Number(t?.width) || 0;
      const h = Number(t?.height) || 0;
      const score = w && h ? w * h : w || h || 1;
      return { url, score };
    })
    .filter(Boolean) as Array<{ url: string; score: number }>;
  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

function pickCoverUrl(raw: any): string | null {
  return (
    normalize((raw as any)?.imageUrl) ||
    normalize((raw as any)?.thumbnail) ||
    pickBestThumbnail((raw as any)?.thumbnails || raw) ||
    null
  );
}

function dedupeByExternalId<T extends { externalId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  items.forEach((item) => {
    const key = normalize(item.externalId);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ ...item, externalId: key });
  });
  return out;
}

function mapAlbums(raw: RawAlbum[]): AlbumInput[] {
  return dedupeByExternalId(
    (raw || []).map((album) => ({
      externalId: (album as any)?.id,
      title: (album as any)?.title,
      albumType: null,
      coverUrl: pickCoverUrl(album),
      source: 'artist_browse',
    } satisfies AlbumInput)),
  );
}

function mapPlaylists(raw: RawPlaylist[]): PlaylistInput[] {
  return dedupeByExternalId(
    (raw || []).map((playlist) => ({
      externalId: (playlist as any)?.id,
      title: (playlist as any)?.title,
      coverUrl: pickCoverUrl(playlist),
      playlistType: 'artist',
      source: 'artist_browse',
    } satisfies PlaylistInput)),
  );
}

function mapTopSongs(raw: RawTopSong[]): TrackInput[] {
  return dedupeByExternalId(
    (raw || []).map((song) => ({
      externalId: (song as any)?.id,
      title: (song as any)?.title,
      durationSec: toSeconds((song as any)?.duration || null),
      imageUrl: pickCoverUrl(song),
      isVideo: true,
      source: 'artist_top_song',
    } satisfies TrackInput)),
  );
}

export async function runPhase2Metadata(params: {
  artistId: string;
  artistKey: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
}): Promise<Phase2Output> {
  const albums = mapAlbums(params.artistBrowse.albums || []);
  const playlists = mapPlaylists(params.artistBrowse.playlists || []);
  const topSongs = mapTopSongs(params.artistBrowse.topSongs || []);

  const albumsWithCover = albums.filter((a) => Boolean(normalize(a.coverUrl))).length;
  const playlistsWithCover = playlists.filter((p) => Boolean(normalize(p.coverUrl))).length;

  const [{ map: albumIdMap }, { map: playlistIdMap }] = await Promise.all([
    upsertAlbums(albums, params.artistId),
    upsertPlaylists(playlists),
  ]);

  const albumExternalIds = albums.map((a) => a.externalId);
  const playlistExternalIds = playlists.map((p) => p.externalId);

  console.info('[phase2] extracted', {
    albums: albums.length,
    playlists: playlists.length,
    topSongs: topSongs.length,
    albumsWithCover,
    playlistsWithCover,
  });

  return {
    artistId: params.artistId,
    artistKey: params.artistKey,
    browseId: params.browseId,
    albums,
    playlists,
    topSongs,
    albumIdMap,
    playlistIdMap,
    albumExternalIds,
    playlistExternalIds,
  };
}

