import { runPhase1Core } from './phases/phase1_core';
import { runPhase2Metadata } from './phases/phase2_metadata';
import { runPhase3Expansion } from './phases/phase3_expansion';
import { nowIso } from './utils';

export type IngestOneArtistParams = {
  browseId?: string;
  artistName?: string;
  requestedArtistKey?: string;
};

export type IngestOneArtistResult = {
  artistKey: string;
  artistId: string;
  browseId: string;
  totalDurationMs: number;
  errors: string[];
};

export async function ingestOneArtist(params: IngestOneArtistParams): Promise<IngestOneArtistResult> {
  const started = Date.now();
  const errors: string[] = [];

  console.info('[ingest][artist] start', { browse_id: params.browseId, artist_name: params.artistName, at: nowIso() });

  const phase1 = await runPhase1Core({
    browseId: params.browseId,
    artistName: params.artistName,
    requestedArtistKey: params.requestedArtistKey,
  });
  const phase2 = await runPhase2Metadata({
    artistId: phase1.artistId,
    artistKey: phase1.artistKey,
    browseId: phase1.browseId,
    artistBrowse: phase1.artistBrowse,
  });

  const albumIds = phase2.albums.map((a) => a.externalId);
  const playlistIds = phase2.playlists.map((p) => p.externalId);

  const phase3 = await runPhase3Expansion({
    artistId: phase1.artistId,
    artistKey: phase1.artistKey,
    albumIds,
    playlistIds,
    albumIdMap: phase2.albumIdMap,
    playlistIdMap: phase2.playlistIdMap,
  });
  errors.push(...phase3.errors);

  const totalDurationMs = Date.now() - started;
  console.info('[ingest][artist] complete', {
    artist_key: phase1.artistKey,
    browse_id: phase1.browseId,
    total_duration_ms: totalDurationMs,
    errors,
    album_count: albumIds.length,
    playlist_count: playlistIds.length,
    track_count: phase3.trackCount,
  });

  return { artistKey: phase1.artistKey, artistId: phase1.artistId, browseId: phase1.browseId, totalDurationMs, errors };
}
