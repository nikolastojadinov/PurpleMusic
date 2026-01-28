import supabase from '../lib/supabase';
import { ingestOneArtist } from '../ingest/ingestOneArtist';

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(Math.max(ms, 0) / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

export async function runNightlyArtistIngestOnce(): Promise<void> {
  const startedAtMs = Date.now();

  const candidate = await pickNextArtistCandidate();
  if (!candidate) {
    console.info('[nightly-artist-ingest] no_candidate');
    return;
  }

  console.info('[nightly-artist-ingest] candidate_selected', candidate);

  try {
    await ingestOneArtist({ browseId: candidate.youtube_channel_id, requestedArtistKey: candidate.artist_key });
  } finally {
    const durationMs = Date.now() - startedAtMs;
    console.info('[nightly-artist-ingest] run_complete', {
      processed: 1,
      duration_ms: durationMs,
      completed_in: formatDuration(durationMs),
    });
  }
}

async function pickNextArtistCandidate(): Promise<{ artist_key: string; youtube_channel_id: string } | null> {
  const { data, error } = await supabase
    .from('artists')
    .select('artist_key, youtube_channel_id')
    .not('youtube_channel_id', 'is', null)
    .order('updated_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[nightly-artist-ingest] candidate_query_failed', { message: error.message });
    return null;
  }
  if (!data || !data.youtube_channel_id) return null;
  return { artist_key: data.artist_key, youtube_channel_id: data.youtube_channel_id };
}
