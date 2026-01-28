import { runPhase1Core } from './phases/phase1_core';
import { runPhase2Metadata } from './phases/phase2_metadata';
import { runPhase3Expansion } from './phases/phase3_expansion';
import { nowIso } from './utils';

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

function assertValidBrowseId(browseId: string): string {
  if (/^UC[A-Za-z0-9_-]+$/.test(browseId)) return browseId;
  throw new Error(`[ingest][artist] invalid browseId resolved: ${browseId}`);
}

export async function ingestOneArtist(params: IngestOneArtistParams): Promise<IngestOneArtistResult> {
  const started = Date.now();
  const errors: string[] = [];

  console.info('[ingest][artist] start', { browse_id: params.browseId, artist_name: params.artistName, at: nowIso() });

  const phase1 = await runPhase1Core({
    browseId: params.browseId,
    artistName: params.artistName,
    requestedArtistKey: params.requestedArtistKey,
    youtubeChannelId: params.youtubeChannelId,
  });

  const browseId = assertValidBrowseId(phase1.browseId);

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
