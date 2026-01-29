// Phase 2: artist browse ingest – extracts albums/playlists/top songs and writes canonical rows.
// Requirements: ensure artist.display_name defaults to name; album/playlist cover_url filled from best thumbnail.

import supabase from '../../lib/supabase';
import {
  normalize,
  toSeconds,
  type AlbumInput,
  type PlaylistInput,
  type TrackInput,
  type IdMap,
} from '../utils';
import { upsertAlbums } from '../utils/upsertAlbums';
import { upsertPlaylists } from '../utils/upsertPlaylists';
import { linkArtistPlaylists } from '../utils/linkArtistPlaylists';
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

function extractBestImageUrl(obj: any): string | null {
  return (
    obj?.thumbnailUrl ??
    obj?.thumbnail?.thumbnails?.at(-1)?.url ??
    obj?.thumbnails?.at(-1)?.url ??
    obj?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ??
    obj?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ??
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
    (raw || []).map((album) => {
      return {
        externalId: (album as any)?.id,
        title: (album as any)?.title,
        albumType: null,
        coverUrl: extractBestImageUrl(album),
        thumbnails: (album as any)?.thumbnails ?? (album as any)?.thumbnail?.thumbnails ?? null,
        source: 'artist_browse',
      } satisfies AlbumInput;
    }),
  );
}

function mapPlaylists(raw: RawPlaylist[]): PlaylistInput[] {
  return dedupeByExternalId(
    (raw || []).map((playlist) => {
      return {
        externalId: (playlist as any)?.id,
        title: (playlist as any)?.title,
        coverUrl: extractBestImageUrl(playlist),
        thumbnails: (playlist as any)?.thumbnails ?? (playlist as any)?.thumbnail?.thumbnails ?? null,
        playlistType: 'artist',
        source: 'artist_browse',
      } satisfies PlaylistInput;
    }),
  );
}

function mapTopSongs(raw: RawTopSong[]): TrackInput[] {
  return dedupeByExternalId(
    (raw || []).map((song) => {
      return {
        externalId: (song as any)?.id,
        title: (song as any)?.title,
        durationSec: toSeconds((song as any)?.duration || null),
        imageUrl: extractBestImageUrl(song),
        isVideo: true,
        source: 'artist_top_song',
      } satisfies TrackInput;
    }),
  );
}

async function ensureArtistDisplayName(artistId: string, fallbackName: string): Promise<void> {
  const name = normalize(fallbackName);
  if (!artistId || !name) return;
  const { error } = await supabase
    .from('artists')
    .update({ display_name: name })
    .eq('id', artistId)
    .is('display_name', null);
  if (error) throw new Error(`[phase2][artist_display_name] ${error.message}`);
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

  await ensureArtistDisplayName(params.artistId, params.artistBrowse.name || params.artistKey);

  console.log('[debug][upsertAlbums] cover_url sample:', albums[0]?.coverUrl ?? null);
  console.log('[debug][upsertPlaylists] cover_url sample:', playlists[0]?.coverUrl ?? null);

  const [{ map: albumIdMap }, { map: playlistIdMap }] = await Promise.all([
    upsertAlbums(albums, params.artistId),
    upsertPlaylists(playlists),
  ]);

  const playlistIds = Object.values(playlistIdMap || {}).filter((id) => Boolean(normalize(id)));
  const linked = playlistIds.length ? await linkArtistPlaylists(params.artistId, playlistIds) : 0;
  console.info('[phase2] linked playlists to artist', { artistId: params.artistId, playlistCount: playlistIds.length, linked });

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

