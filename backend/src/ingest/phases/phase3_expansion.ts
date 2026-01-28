import pLimit from 'p-limit';
import { fetchAlbumBrowse, fetchPlaylistBrowse } from '../../ytmusic/innertubeClient';
import {
  linkAlbumTracks,
  linkArtistTracks,
  linkPlaylistTracks,
  normalize,
  nowIso,
  seedArtistsFromNames,
  toSeconds,
  upsertTracks,
} from '../utils';

export type Phase3Output = {
  albumsIngested: number;
  playlistsIngested: number;
  trackCount: number;
  errors: string[];
};

const ALBUM_CONCURRENCY = 3;
const PLAYLIST_CONCURRENCY = 3;

function orderedTrackIds(tracks: Array<{ videoId: string }>, idMap: Record<string, string>): string[] {
  return tracks
    .map((t) => normalize(t.videoId))
    .map((id) => idMap[id])
    .filter(Boolean);
}

async function ingestSingleAlbum(
  artistId: string,
  artistKey: string,
  externalId: string,
  albumIdMap: Record<string, string>,
): Promise<{ tracks: number }> {
  const albumBrowse = await fetchAlbumBrowse(externalId);
  if (!albumBrowse) return { tracks: 0 };

  const tracks = (albumBrowse.tracks || []).map((t) => ({
    externalId: t.videoId,
    title: t.title,
    durationSec: toSeconds(t.duration),
    imageUrl: t.thumbnail,
    isVideo: true,
    source: 'album',
  }));
  const { map } = await upsertTracks(tracks);
  const ordered = orderedTrackIds(albumBrowse.tracks, map);
  const albumId = albumIdMap[normalize(albumBrowse.browseId)] || albumIdMap[externalId];
  if (albumId && ordered.length) await linkAlbumTracks(albumId, ordered);
  if (ordered.length) await linkArtistTracks(artistId, ordered);
  return { tracks: ordered.length };
}

async function ingestSinglePlaylist(
  artistId: string,
  artistKey: string,
  externalId: string,
  playlistIdMap: Record<string, string>,
): Promise<{ tracks: number; artistNames: string[] }> {
  const playlistBrowse = await fetchPlaylistBrowse(externalId);
  if (!playlistBrowse) return { tracks: 0, artistNames: [] };

  const artistNames = (playlistBrowse.tracks || [])
    .map((t) => t.artist)
    .filter((name): name is string => Boolean(name));

  const tracks = (playlistBrowse.tracks || []).map((t) => ({
    externalId: t.videoId,
    title: t.title,
    durationSec: toSeconds(t.duration),
    imageUrl: t.thumbnail,
    isVideo: true,
    source: 'playlist',
  }));
  const { map } = await upsertTracks(tracks);
  const ordered = orderedTrackIds(playlistBrowse.tracks, map);
  const playlistId = playlistIdMap[normalize(playlistBrowse.browseId)] || playlistIdMap[externalId];
  if (playlistId && ordered.length) await linkPlaylistTracks(playlistId, ordered);
  if (ordered.length) await linkArtistTracks(artistId, ordered);
  return { tracks: ordered.length, artistNames };
}

export async function runPhase3Expansion(params: {
  artistId: string;
  artistKey: string;
  albumIds: string[];
  playlistIds: string[];
  albumIdMap: Record<string, string>;
  playlistIdMap: Record<string, string>;
}): Promise<Phase3Output> {
  const started = Date.now();
  console.info('[ingest][phase3_expansion] phase_start', {
    artist_key: params.artistKey,
    albums: params.albumIds.length,
    playlists: params.playlistIds.length,
    at: nowIso(),
  });

  const errors: string[] = [];
  const albumLimiter = pLimit(ALBUM_CONCURRENCY);
  const playlistLimiter = pLimit(PLAYLIST_CONCURRENCY);

  const albumResults = await Promise.allSettled(
    params.albumIds.map((albumId) =>
      albumLimiter(async () => {
        const result = await ingestSingleAlbum(params.artistId, params.artistKey, albumId, params.albumIdMap);
        return result.tracks;
      }),
    ),
  );

  const playlistResults = await Promise.allSettled(
    params.playlistIds.map((playlistId) =>
      playlistLimiter(async () => {
        const result = await ingestSinglePlaylist(params.artistId, params.artistKey, playlistId, params.playlistIdMap);
        return result;
      }),
    ),
  );

  const albumsIngested = albumResults.filter((r) => r.status === 'fulfilled').length;
  const playlistsIngested = playlistResults.filter((r) => r.status === 'fulfilled').length;
  const trackCount =
    albumResults.reduce((acc, cur) => (cur.status === 'fulfilled' ? acc + cur.value : acc), 0) +
    playlistResults.reduce((acc, cur) => (cur.status === 'fulfilled' ? acc + cur.value.tracks : acc), 0);

  const seededNames: string[] = [];

  albumResults.forEach((r, idx) => {
    if (r.status === 'rejected') errors.push(`album:${params.albumIds[idx]}:${r.reason}`);
  });
  playlistResults.forEach((r, idx) => {
    if (r.status === 'rejected') {
      errors.push(`playlist:${params.playlistIds[idx]}:${r.reason}`);
    } else {
      seededNames.push(...r.value.artistNames);
    }
  });

  if (seededNames.length) {
    const inserted = await seedArtistsFromNames(seededNames);
    console.info('[ingest][phase3_expansion][seed-artists]', { inserted, from: 'playlists' });
  }

  console.info('[ingest][phase3_expansion] phase_complete', {
    artist_key: params.artistKey,
    albums_processed: params.albumIds.length,
    playlists_processed: params.playlistIds.length,
    albums_ingested: albumsIngested,
    playlists_ingested: playlistsIngested,
    track_count: trackCount,
    duration_ms: Date.now() - started,
  });

  return { albumsIngested, playlistsIngested, trackCount, errors };
}
