import pLimit from 'p-limit';
import { fetchAlbumBrowse, fetchPlaylistBrowse } from '../../ytmusic/innertubeClient';
import {
  linkAlbumTracks,
  linkArtistTracks,
  linkPlaylistTracks,
  normalize,
  nowIso,
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

async function ingestSingleAlbum(artistKey: string, externalId: string, albumIdMap: Record<string, string>): Promise<{ tracks: number }> {
  const albumBrowse = await fetchAlbumBrowse(externalId);
  if (!albumBrowse) return { tracks: 0 };

  const tracks = (albumBrowse.tracks || []).map((t) => ({
    youtubeId: t.videoId,
    title: t.title,
    artistNames: [artistKey],
    durationSeconds: toSeconds(t.duration),
    thumbnailUrl: t.thumbnail,
    albumExternalId: albumBrowse.browseId,
    isVideo: true,
    source: 'album',
  }));
  const { idMap } = await upsertTracks(tracks, albumIdMap);
  const ordered = orderedTrackIds(albumBrowse.tracks, idMap);
  const albumId = albumIdMap[normalize(albumBrowse.browseId)] || albumIdMap[externalId];
  if (albumId && ordered.length) await linkAlbumTracks(albumId, ordered);
  if (ordered.length) await linkArtistTracks(artistKey, ordered);
  return { tracks: ordered.length };
}

async function ingestSinglePlaylist(artistKey: string, externalId: string, playlistIdMap: Record<string, string>): Promise<{ tracks: number }> {
  const playlistBrowse = await fetchPlaylistBrowse(externalId);
  if (!playlistBrowse) return { tracks: 0 };

  const tracks = (playlistBrowse.tracks || []).map((t) => ({
    youtubeId: t.videoId,
    title: t.title,
    artistNames: [t.artist || artistKey],
    durationSeconds: toSeconds(t.duration),
    thumbnailUrl: t.thumbnail,
    isVideo: true,
    source: 'playlist',
  }));
  const { idMap } = await upsertTracks(tracks, {});
  const ordered = orderedTrackIds(playlistBrowse.tracks, idMap);
  const playlistId = playlistIdMap[normalize(playlistBrowse.browseId)] || playlistIdMap[externalId];
  if (playlistId && ordered.length) await linkPlaylistTracks(playlistId, ordered);
  if (ordered.length) await linkArtistTracks(artistKey, ordered);
  return { tracks: ordered.length };
}

export async function runPhase3Expansion(params: {
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
        const result = await ingestSingleAlbum(params.artistKey, albumId, params.albumIdMap);
        return result.tracks;
      }),
    ),
  );

  const playlistResults = await Promise.allSettled(
    params.playlistIds.map((playlistId) =>
      playlistLimiter(async () => {
        const result = await ingestSinglePlaylist(params.artistKey, playlistId, params.playlistIdMap);
        return result.tracks;
      }),
    ),
  );

  const albumsIngested = albumResults.filter((r) => r.status === 'fulfilled').length;
  const playlistsIngested = playlistResults.filter((r) => r.status === 'fulfilled').length;
  const trackCount =
    albumResults.reduce((acc, cur) => (cur.status === 'fulfilled' ? acc + cur.value : acc), 0) +
    playlistResults.reduce((acc, cur) => (cur.status === 'fulfilled' ? acc + cur.value : acc), 0);

  albumResults.forEach((r, idx) => {
    if (r.status === 'rejected') errors.push(`album:${params.albumIds[idx]}:${r.reason}`);
  });
  playlistResults.forEach((r, idx) => {
    if (r.status === 'rejected') errors.push(`playlist:${params.playlistIds[idx]}:${r.reason}`);
  });

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
