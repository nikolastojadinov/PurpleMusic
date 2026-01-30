// PORTED FROM legacy hajde-music-stream:
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/fullArtistIngest.ts
// function(s): runFullArtistIngest
import { runPhase1Core } from './phases/phase1_core';
import { runPhase2Metadata } from './phases/phase2_metadata';
import { runPhase3Expansion } from './phases/phase3_expansion';
import { nowIso } from './utils';
import supabase from '../lib/supabase';

export type IngestOneArtistParams = {
  browseId?: string;
  artistName?: string;
  requestedArtistKey: string;
  youtubeChannelId?: string;
};

export type IngestOneArtistResult = {
  artistKey: string;
  artistId: string;
  browseId: string;
  totalDurationMs: number;
  errors: string[];
};

async function recordIngestRequest(params: IngestOneArtistParams): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('ingest_requests')
      .insert({ source: 'artist', payload: params, status: 'received' })
      .select('id')
      .maybeSingle();

    if (error) {
      console.warn('[ingest][artist] failed to persist ingest request', { message: error.message });
      return;
    }

    if (data?.id) {
      console.info('[ingest][artist] stored ingest request', { id: data.id });
    }
  } catch (err: any) {
    console.warn('[ingest][artist] unexpected error while persisting ingest request', { message: err?.message });
  }
}

function requireUcBrowseId(browseId: string): string {
  if (/^UC[A-Za-z0-9_-]+$/.test(browseId)) return browseId;
  throw new Error(`[ingest][artist] invalid browseId ${browseId}`);
}

export async function ingestOneArtist(params: IngestOneArtistParams): Promise<IngestOneArtistResult> {
  const started = Date.now();
  const errors: string[] = [];

  console.info('[ingest][artist] start', { browse_id: params.browseId, artist_name: params.artistName, at: nowIso() });

  await recordIngestRequest(params);

  const phase1 = await runPhase1Core({
    browseId: params.browseId,
    artistName: params.artistName,
    requestedArtistKey: params.requestedArtistKey,
    youtubeChannelId: params.youtubeChannelId,
  });

  const browseId = requireUcBrowseId(phase1.browseId);
  console.info('[ingest][artist] browse_resolved', { browse_id: browseId });

  const phase2 = await runPhase2Metadata({
    artistId: phase1.artistId,
    artistKey: phase1.artistKey,
    browseId,
    artistBrowse: phase1.artistBrowse,
  });

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

  const totalDurationMs = Date.now() - started;

  console.info('[ingest][artist] complete', {
    artist_key: phase1.artistKey,
    browse_id: browseId,
    album_count: phase2.albums.length,
    playlist_count: phase2.playlists.length,
    track_count: phase3.trackCount,
  });

  return { artistKey: phase1.artistKey, artistId: phase1.artistId, browseId, totalDurationMs, errors };
}
