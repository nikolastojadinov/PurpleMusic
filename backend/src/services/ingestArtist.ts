import { runPhase1Core } from '../ingest/phases/phase1_core';
import { runPhase2Metadata } from '../ingest/phases/phase2_metadata';
import { runPhase3Expansion } from '../ingest/phases/phase3_expansion';
import { normalize, nowIso } from '../ingest/utils';
import type { Phase1Output } from '../ingest/phases/phase1_core';
import type { Phase2Output } from '../ingest/phases/phase2_metadata';

export type IngestArtistParams = {
  browseId?: string;
  artistName?: string;
  requestedArtistKey: string;
  youtubeChannelId?: string;
};

export type IngestArtistResult = {
  artistKey: string | null;
  artistId: string | null;
  browseId: string | null;
  totalDurationMs: number;
  albumCount: number;
  playlistCount: number;
  topSongCount: number;
  trackCount: number;
  newArtistInserted: boolean;
  errors: string[];
};

function safeMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown_error';
}

function log(event: string, payload: Record<string, any>) {
  const { run_id: runId, artist_key: artistKey } = payload;
  console.info('[ingest][artist]', { event, run_id: runId, artist_key: artistKey, ...payload });
}

export async function ingestArtist(params: IngestArtistParams): Promise<IngestArtistResult> {
  const runId = `artist-${Date.now().toString(36)}`;
  const started = Date.now();
  const errors: string[] = [];

  const label = params.artistName || params.browseId || params.requestedArtistKey;
  const baseContext = { run_id: runId, artist_key: normalize(params.requestedArtistKey) };

  let phase1: Phase1Output | null = null;
  let phase2: Phase2Output | null = null;
  let trackCount = 0;
  let newArtistInserted = false;

  const finalize = (): IngestArtistResult => {
    const totalDurationMs = Date.now() - started;
    log('complete', {
      ...baseContext,
      browse_id: phase1?.browseId ?? params.browseId ?? null,
      artist_id: phase1?.artistId ?? null,
      albums: phase2?.albums.length ?? 0,
      playlists: phase2?.playlists.length ?? 0,
      top_songs: phase2?.topSongs.length ?? 0,
      tracks: trackCount,
      new_artist_inserted: newArtistInserted,
      total_duration_ms: totalDurationMs,
      errors,
    });

    return {
      artistKey: phase1?.artistKey ?? normalize(params.requestedArtistKey),
      artistId: phase1?.artistId ?? null,
      browseId: phase1?.browseId ?? params.browseId ?? null,
      albumCount: phase2?.albums.length ?? 0,
      playlistCount: phase2?.playlists.length ?? 0,
      topSongCount: phase2?.topSongs.length ?? 0,
      trackCount,
      newArtistInserted,
      totalDurationMs,
      errors,
    };
  };

  log('start', { ...baseContext, label, browse_id: params.browseId ?? null, at: nowIso() });

  try {
    const phase1Started = Date.now();
    phase1 = await runPhase1Core({
      browseId: params.browseId,
      artistName: params.artistName,
      requestedArtistKey: params.requestedArtistKey,
      youtubeChannelId: params.youtubeChannelId,
    });

    log('phase1_complete', {
      ...baseContext,
      browse_id: phase1.browseId,
      artist_id: phase1.artistId,
      duration_ms: Date.now() - phase1Started,
    });
  } catch (err) {
    const message = safeMessage(err);
    errors.push(message);
    log('error', { ...baseContext, stage: 'phase1_core', message });
    return finalize();
  }

  try {
    const phase2Started = Date.now();
    phase2 = await runPhase2Metadata({
      artistId: phase1.artistId,
      artistKey: phase1.artistKey,
      browseId: phase1.browseId,
      artistBrowse: phase1.artistBrowse,
    });

    log('phase2_complete', {
      ...baseContext,
      albums: phase2.albums.length,
      playlists: phase2.playlists.length,
      top_songs: phase2.topSongs.length,
      duration_ms: Date.now() - phase2Started,
    });
  } catch (err) {
    const message = safeMessage(err);
    errors.push(message);
    log('error', { ...baseContext, stage: 'phase2_metadata', message });
    return finalize();
  }

  try {
    const phase3Started = Date.now();
    const phase3 = await runPhase3Expansion({
      artistId: phase1.artistId,
      artistKey: phase1.artistKey,
      albums: phase2.albums,
      playlists: phase2.playlists,
      topSongs: phase2.topSongs,
      albumIdMap: phase2.albumIdMap,
      playlistIdMap: phase2.playlistIdMap,
      albumExternalIds: phase2.albumExternalIds,
      playlistExternalIds: phase2.playlistExternalIds,
    });

    trackCount = phase3.trackCount;

    log('phase3_complete', {
      ...baseContext,
      tracks_ingested: phase3.trackCount,
      albums_processed: phase3.albumsProcessed,
      playlists_processed: phase3.playlistsProcessed,
      duration_ms: Date.now() - phase3Started,
    });
  } catch (err) {
    const message = safeMessage(err);
    errors.push(message);
    log('error', { ...baseContext, stage: 'phase3_expansion', message });
    return finalize();
  }

  return finalize();
}
