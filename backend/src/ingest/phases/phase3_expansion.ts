import pLimit from 'p-limit';
import { fetchAlbumBrowse, fetchPlaylistBrowse, type YTMusicTrack } from '../../ytmusic/innertubeClient';
import { linkAlbumTracks, linkArtistTracks, linkPlaylistTracks, normalize, nowIso, seedArtistsFromNames, toSeconds, upsertTracks } from '../utils';

export type Phase3Output = {
  albumsIngested: number;
  playlistsIngested: number;
  trackCount: number;
  errors: string[];
};

const ALBUM_CONCURRENCY = 3;
const PLAYLIST_CONCURRENCY = 3;

type IdMap = Record<string, string>;

type AlbumIngestResult = { trackCount: number };
type PlaylistIngestResult = { trackCount: number; artistNames: string[] };

function buildTrackInputs(tracks: YTMusicTrack[], source: 'album' | 'playlist'): Array<{ externalId: string; title: string; durationSec: number | null; imageUrl: string | null; isVideo: boolean; source: string }> {
  return (tracks || []).map((t) => ({
    externalId: t.videoId,
    title: t.title,
    durationSec: toSeconds(t.duration),
    imageUrl: t.thumbnail,
    isVideo: true,
    source,
  }));
}

function orderedTrackIds(tracks: Array<{ videoId: string }>, idMap: IdMap): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  (tracks || []).forEach((track) => {
    const videoId = normalize(track.videoId);
    if (!videoId) return;
    const id = idMap[videoId];
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  });
  return ordered;
}

function resolveMappedId(externalId: string, browseId: string | null | undefined, idMap: IdMap): string | undefined {
  const browseKey = normalize(browseId);
  if (browseKey && idMap[browseKey]) return idMap[browseKey];
  const externalKey = normalize(externalId);
  if (externalKey && idMap[externalKey]) return idMap[externalKey];
  return undefined;
}

function uniqueNames(names: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  names.forEach((name) => {
    const normalized = normalize(name);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    result.push(normalized);
  });
  return result;
}

async function ingestAlbum(artistId: string, externalId: string, albumIdMap: IdMap): Promise<AlbumIngestResult> {
  const albumBrowse = await fetchAlbumBrowse(externalId);
  if (!albumBrowse) return { trackCount: 0 };

  const trackInputs = buildTrackInputs(albumBrowse.tracks || [], 'album');
  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(albumBrowse.tracks || [], map);

  const albumId = resolveMappedId(externalId, albumBrowse.browseId, albumIdMap);
  if (albumId && ordered.length) await linkAlbumTracks(albumId, ordered);
  if (ordered.length) await linkArtistTracks(artistId, ordered);

  return { trackCount: ordered.length };
}

async function ingestPlaylist(artistId: string, externalId: string, playlistIdMap: IdMap): Promise<PlaylistIngestResult> {
  const playlistBrowse = await fetchPlaylistBrowse(externalId);
  if (!playlistBrowse) return { trackCount: 0, artistNames: [] };

  const trackInputs = buildTrackInputs(playlistBrowse.tracks || [], 'playlist');
  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(playlistBrowse.tracks || [], map);

  const playlistId = resolveMappedId(externalId, playlistBrowse.browseId, playlistIdMap);
  if (playlistId && ordered.length) await linkPlaylistTracks(playlistId, ordered);
  if (ordered.length) await linkArtistTracks(artistId, ordered);

  const artistNames = uniqueNames((playlistBrowse.tracks || []).map((t) => t.artist));
  return { trackCount: ordered.length, artistNames };
}

export async function runPhase3Expansion(params: {
  artistId: string;
  artistKey: string;
  albumIds: string[];
  playlistIds: string[];
  albumIdMap: IdMap;
  playlistIdMap: IdMap;
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
    params.albumIds.map((albumExternalId) => albumLimiter(() => ingestAlbum(params.artistId, albumExternalId, params.albumIdMap))),
  );

  const playlistResults = await Promise.allSettled(
    params.playlistIds.map((playlistExternalId) =>
      playlistLimiter(() => ingestPlaylist(params.artistId, playlistExternalId, params.playlistIdMap)),
    ),
  );

  let trackCount = 0;
  let albumsIngested = 0;
  let playlistsIngested = 0;
  const seededNames: string[] = [];

  albumResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      albumsIngested += 1;
      trackCount += result.value.trackCount;
    } else {
      errors.push(`album:${params.albumIds[idx]}:${result.reason}`);
    }
  });

  playlistResults.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      playlistsIngested += 1;
      trackCount += result.value.trackCount;
      seededNames.push(...result.value.artistNames);
    } else {
      errors.push(`playlist:${params.playlistIds[idx]}:${result.reason}`);
    }
  });

  const uniqueSeeded = uniqueNames(seededNames);
  if (uniqueSeeded.length) {
    const inserted = await seedArtistsFromNames(uniqueSeeded);
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

