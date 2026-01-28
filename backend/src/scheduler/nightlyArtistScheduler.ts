import cron from 'node-cron';
import { runNightlyArtistIngestOnce } from '../jobs/nightlyArtistIngest';

const CRON_EXPRESSION = '0 2 * * *'; // 02:00 UTC daily
let scheduled = false;

export function startNightlyArtistScheduler(): void {
  if (scheduled) return;
  cron.schedule(CRON_EXPRESSION, async () => {
    try {
      await runNightlyArtistIngestOnce();
    } catch (err: any) {
      console.error('[nightly-artist-scheduler] run_failed', { message: err?.message || String(err) });
    }
  }, { timezone: 'UTC' });
  scheduled = true;
  console.info('[nightly-artist-scheduler] scheduled', { cron: CRON_EXPRESSION });
}
