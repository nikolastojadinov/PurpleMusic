// backend/src/ingest/phases/phase2_metadata.ts
// Phase 2: artist browse ingest – extracts albums/playlists/top songs and writes canonical rows.
//
// This phase MUST:
// - upsert albums
// - upsert playlists
// - upsert top songs as tracks
// - link artist ↔ albums/playlists
// - link artist ↔ top songs in artist_tracks with position ordering
//
// Top Songs ordering MUST match YouTube Music shelf order (1..N)

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
import { upsertTracks } from '../utils/upsertTracks';

import { linkArtistPlaylists } from '../utils/linkArtistPlaylists';
import { linkArtistAlbums } from '../utils/linkArtistAlbums';
import { linkArtistTracks } from '../utils/linkArtistTracks';

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
  topSongIdMap: IdMap;

  albumExternalIds: string[];
  playlistExternalIds: string[];
  topSongExternalIds: string[];
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

  for (const item of items) {
    const key = normalize(item.externalId);
    if (!key) continue;
    if (seen.has(key)) continue;

    seen.add(key);
    out.push({ ...item, externalId: key });
  }

  return out;
}

/**
 * Albums
 */
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

/**
 * Playlists
 */
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

/**
 * Top Songs → Tracks
 *
 * IMPORTANT:
 * - We preserve shelf order exactly as returned (position = index+1)
 * - We ingest these into canonical `tracks`
 */
function mapTopSongs(raw: RawTopSong[]): TrackInput[] {
  return dedupeByExternalId(
    (raw || []).map((song) => {
      const externalId = (song as any)?.videoId || (song as any)?.id;

      return {
        externalId,
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
  console.info('[ingest][phase2] phase_start', {
    artistKey: params.artistKey,
    browseId: params.browseId,
  });

  /**
   * Step 1: Extract canonical entities
   */
  const albums = mapAlbums(params.artistBrowse.albums || []);
  const playlists = mapPlaylists(params.artistBrowse.playlists || []);
  const topSongs = mapTopSongs(params.artistBrowse.topSongs || []);

  console.info('[phase2] extracted counts', {
    albums: albums.length,
    playlists: playlists.length,
    topSongs: topSongs.length,
  });

  /**
   * Step 2: Ensure artist display name
   */
  await ensureArtistDisplayName(params.artistId, params.artistBrowse.name || params.artistKey);

  /**
   * Step 3: Upsert albums, playlists, tracks (top songs)
   */
  const [{ map: albumIdMap }, { map: playlistIdMap }, { map: topSongIdMap }] =
    await Promise.all([
      upsertAlbums(albums, params.artistId),
      upsertPlaylists(playlists),
      upsertTracks(topSongs),
    ]);

  /**
   * Step 4: Link artist ↔ albums/playlists
   */
  const albumIds = Object.values(albumIdMap || {}).filter(Boolean);
  if (albumIds.length) {
    await linkArtistAlbums(params.artistKey, albumIds);
  }

  const playlistIds = Object.values(playlistIdMap || {}).filter(Boolean);
  if (playlistIds.length) {
    await linkArtistPlaylists(params.artistId, playlistIds);
  }

  /**
   * Step 5: Link artist ↔ top songs (artist_tracks)
   *
   * We MUST preserve ordering:
   * position = shelf index + 1
   */
  const topTrackIds = topSongs
    .map((t) => topSongIdMap[t.externalId])
    .filter((id) => Boolean(normalize(id)));

  if (topTrackIds.length) {
    const pairs = topTrackIds.map((trackId, idx) => ({
      trackId,
      position: idx + 1,
    }));

    await linkArtistTracks(params.artistKey, pairs, {
      isTopSong: true,
    });

    console.info('[phase2] linked top songs', {
      artistKey: params.artistKey,
      count: pairs.length,
    });
  } else {
    console.info('[phase2] no top songs linked (empty)');
  }

  console.info('[ingest][phase2] phase_complete', {
    artistKey: params.artistKey,
    albums: albums.length,
    playlists: playlists.length,
    topSongs: topSongs.length,
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
    topSongIdMap,

    albumExternalIds: albums.map((a) => a.externalId),
    playlistExternalIds: playlists.map((p) => p.externalId),
    topSongExternalIds: topSongs.map((t) => t.externalId),
  };
}
