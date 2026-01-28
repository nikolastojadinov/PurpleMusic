// target file: backend/src/server.ts
//
// FULL REWRITE
// Adds a minimal /api/debug/browse endpoint directly in the main Express server
// so we can inspect what youtubeMusicClient.browsePlaylistById() returns on Render.
// This is required because Phase3 currently fetches 0 tracks for all albums/playlists.

import express from "express";
import supabase from "./lib/supabase";
import { runNightlyArtistIngestOnce } from "./jobs/nightlyArtistIngest";

const app = express();
const port = Number(process.env.PORT) || 3000;

/**
 * Health check
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * DEBUG: Browse raw playlist/album response from Innertube
 *
 * Example:
 *   GET /api/debug/browse?id=MPREb_JkRVr42eEZv
 *
 * Returns:
 * - trackCount
 * - firstTrackSample
 * - top-level keys from raw response
 *
 * This endpoint is ONLY for debugging ingestion issues (0 tracks fetched).
 */
app.get("/api/debug/browse", async (req, res) => {
  const id = req.query.id as string;

  if (!id) {
    return res.status(400).json({
      ok: false,
      error: "Missing ?id=",
    });
  }

  console.log("[debug] browse request", { id });

  try {
    // Lazy import so server boots even if client has issues
    const { youtubeMusicClient } = await import(
      "./services/youtubeMusicClient"
    );

    const raw = await youtubeMusicClient.browsePlaylistById(id);

    return res.json({
      ok: true,
      browseId: id,
      trackCount: raw?.tracks?.length ?? 0,
      firstTrackSample: raw?.tracks?.[0] ?? null,
      rawKeys: raw ? Object.keys(raw).slice(0, 50) : [],
    });
  } catch (err: any) {
    console.error("[debug] browse failed", err);

    return res.status(500).json({
      ok: false,
      error: err?.message || String(err),
    });
  }
});

/**
 * Start server
 */
app.listen(port, () => {
  // Supabase client is initialized on import for readiness; no calls yet.
  void supabase;

  console.log(`Server listening on port ${port}`);

  // Run ingest once after deploy (temporary boot test)
  setTimeout(async () => {
    console.log("[boot] running ONE-SHOT artist ingest after deploy...");
    try {
      await runNightlyArtistIngestOnce();
      console.log("[boot] ONE-SHOT ingest finished.");
    } catch (err: any) {
      console.error(
        "[boot] ONE-SHOT ingest failed:",
        err?.message || String(err)
      );
    }
  }, 3000);
});
