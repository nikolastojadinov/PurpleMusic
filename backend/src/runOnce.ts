import supabase from './lib/supabase';
import { ingestOneArtist } from './ingest/ingestOneArtist';

async function main() {
  const { data, error } = await supabase
    .from('artists')
    .select('artist_key, name, youtube_channel_id')
    .order('updated_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`supabase select failed: ${error.message}`);
  if (!data?.artist_key) {
    console.info('[runOnce] no artists available to ingest');
    return;
  }

  const browseId = data.youtube_channel_id || undefined;
  console.info('[runOnce] ingest_start', { artist_key: data.artist_key, browse_id: browseId, name: data.name });

  const result = await ingestOneArtist({ browseId, artistName: data.name || undefined, requestedArtistKey: data.artist_key });
  console.info('[runOnce] ingest_complete', result);
}

main()
  .catch((err) => {
    console.error('[runOnce] error', err);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
