// target file: backend/src/server.ts
//
// FULL REWRITE
// Adds a minimal /api/debug/browse endpoint directly in Express
// to inspect what browsePlaylistById() returns (Phase3 currently fetches 0 tracks).

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
    // Correct import: browsePlaylistById is a named export
    const { browsePlaylistById } = await import(
      "./services/youtubeMusicClient"
    );

    const raw = await browsePlaylistById(id);

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
  void supabase;

  console.log(`Server listening on port ${port}`);

  // ONE-SHOT ingest after deploy (temporary test)
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
