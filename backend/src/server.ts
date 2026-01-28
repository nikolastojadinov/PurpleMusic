import express from 'express';
import supabase from './lib/supabase';
import { runNightlyArtistIngestOnce } from './jobs/nightlyArtistIngest';

const app = express();
const port = Number(process.env.PORT) || 3000;

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  // Supabase client is initialized on import for readiness; no calls yet.
  void supabase;
  console.log(`Server listening on port ${port}`);

  setTimeout(async () => {
    console.log('[boot] running ONE-SHOT artist ingest after deploy...');
    try {
      await runNightlyArtistIngestOnce();
      console.log('[boot] ONE-SHOT ingest finished.');
    } catch (err: any) {
      console.error('[boot] ONE-SHOT ingest failed:', err?.message || String(err));
    }
  }, 3000);
});
