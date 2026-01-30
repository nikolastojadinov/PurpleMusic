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
import { linkArtistAlbums } from '../utils/linkArtistAlbums';

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

/**
 * NEW: Persist Top Songs into artist_tracks with role='top_song'
 * Minimal inline insert, no external helper file needed.
 */
async function linkTopSongsToArtist(params: {
  artistId: string;
  artistKey: string;
  topSongs: TrackInput[];
}) {
  if (!params.topSongs.length) return;

  // Load track ids from DB
  const externalIds = params.topSongs.map((t) => normalize(t.externalId));

  const { data: trackRows, error: trackErr } = await supabase
    .from('tracks')
    .select('id, external_id')
    .in('external_id', externalIds);

  if (trackErr) throw new Error(`[phase2][top_songs] failed loading tracks: ${trackErr.message}`);

  const idMap = new Map<string, string>();
  (trackRows || []).forEach((row) => {
    idMap.set(normalize(row.external_id), row.id);
  });

  const inserts = params.topSongs
    .map((song, idx) => {
      const tid = idMap.get(normalize(song.externalId));
      if (!tid) return null;
      return {
        artist_id: params.artistId,
        artist_key: params.artistKey,
        track_id: tid,
        role: 'top_song',
        position: idx + 1,
      };
    })
    .filter(Boolean);

  if (!inserts.length) return;

  const { error: insErr } = await supabase
    .from('artist_tracks')
    .upsert(inserts, { onConflict: 'artist_key,track_id' });

  if (insErr) throw new Error(`[phase2][top_songs] insert failed: ${insErr.message}`);

  console.info('[phase2] linked top songs', {
    artistKey: params.artistKey,
    count: inserts.length,
  });
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

  await ensureArtistDisplayName(params.artistId, params.artistBrowse.name || params.artistKey);

  // Existing logic (do not break)
  const [{ map: albumIdMap }, { map: playlistIdMap }] = await Promise.all([
    upsertAlbums(albums, params.artistId),
    upsertPlaylists(playlists),
  ]);

  const albumIds = Object.values(albumIdMap || {}).filter(Boolean);
  if (albumIds.length) await linkArtistAlbums(params.artistKey, albumIds);

  const playlistIds = Object.values(playlistIdMap || {}).filter(Boolean);
  if (playlistIds.length) await linkArtistPlaylists(params.artistId, playlistIds);

  // NEW: Link Top Songs safely
  await linkTopSongsToArtist({
    artistId: params.artistId,
    artistKey: params.artistKey,
    topSongs,
  });

  console.info('[phase2] extracted', {
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
    albumExternalIds: albums.map((a) => a.externalId),
    playlistExternalIds: playlists.map((p) => p.externalId),
  };
}
