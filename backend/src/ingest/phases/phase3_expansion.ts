// target file: backend/src/ingest/phases/phase3_expansion.ts

import pLimit from "p-limit";
import supabase from "../../lib/supabase";

/**
 * ✅ CRITICAL FIX:
 * Phase3 MUST use the real working YouTube Music client parser,
 * NOT the thin wrapper in ../../ytmusic/innertubeClient.
 */
import {
  browsePlaylistById,
  type PlaylistBrowse,
} from "../../services/youtubeMusicClient";

import {
  linkAlbumTracks,
  linkArtistTracks,
  linkPlaylistTracks,
  normalize,
  toSeconds,
  nowIso,
  type AlbumInput,
  type PlaylistInput,
  type TrackInput,
  type IdMap,
} from "../utils";
import { upsertTracks } from "../utils/upsertTracks";

export type Phase3Input = {
  artistId: string;
  artistKey: string;

  albums: AlbumInput[];
  playlists: PlaylistInput[];
  topSongs: TrackInput[];

  albumIdMap: IdMap;
  playlistIdMap: IdMap;

  // ✅ kept for compatibility with ingestOneArtist.ts
  albumExternalIds: string[];
  playlistExternalIds: string[];
};

export type Phase3Output = {
  trackCount: number;
  albumsProcessed: number;
  playlistsProcessed: number;
};

const CONCURRENCY = 3;

type BuiltTrack = {
  input: TrackInput;
  artistNames: string[];
  videoId: string;
};

function shouldSkipRadioMix(externalIdRaw: string): boolean {
  const upper = normalize(externalIdRaw).toUpperCase();
  return upper.includes("RDCLAK") || upper.startsWith("RD");
}

/**
 * Normalize playlist/album browse IDs.
 */
function normalizePlaylistId(externalIdRaw: string): { valid: boolean; id: string } {
  const externalId = normalize(externalIdRaw);
  if (!externalId) return { valid: false, id: "" };

  const upper = externalId.toUpperCase();

  if (upper.startsWith("VL")) return { valid: true, id: externalId };
  if (upper.startsWith("MPRE")) return { valid: true, id: externalId };
  if (upper.startsWith("OLAK5UY")) return { valid: true, id: externalId };

  if (upper.startsWith("PL")) return { valid: true, id: `VL${externalId}` };

  return { valid: false, id: "" };
}

function extractBestImageUrl(obj: any): string | null {
  return (
    obj?.coverUrl ??
    obj?.imageUrl ??
    obj?.thumbnailUrl ??
    obj?.thumbnail?.thumbnails?.at(-1)?.url ??
    obj?.thumbnails?.at(-1)?.url ??
    obj?.musicThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ??
    obj?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails?.at(-1)?.url ??
    null
  );
}

function getTrackVideoId(t: any): string {
  return normalize(t?.videoId ?? (t as any)?.external_id ?? "");
}

function normalizeArtistKey(name: string): string {
  const base = normalize(name).toLowerCase();
  const underscored = base.replace(/\s+/g, "_");
  return underscored || "artist";
}

function extractTrackArtistNames(t: any): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  const add = (raw: unknown) => {
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) return;
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    names.push(value);
  };

  const runCollections = [
    (t as any)?.artists,
    (t as any)?.artist,
    (t as any)?.subtitle?.runs,
    (t as any)?.shortBylineText?.runs,
  ];

  runCollections.forEach((runs: any) => {
    if (!runs || !Array.isArray(runs)) return;
    runs.forEach((r: any) => add(r?.name ?? r?.text ?? r?.content ?? r));
  });

  add((t as any)?.author);
  add((t as any)?.byline);

  return names;
}

async function upsertStubArtist(name: string): Promise<string | null> {
  const cleaned = normalize(name);
  if (!cleaned) return null;

  const artistKey = normalizeArtistKey(cleaned);
  const timestamp = nowIso();

  const row = {
    artist_key: artistKey,
    name: cleaned,
    source: "playlist_track",
    updated_at: timestamp,
  };

  const { error } = await supabase
    .from("artists")
    .upsert(row, { onConflict: "artist_key", ignoreDuplicates: true });
  if (error) throw new Error(`[playlist_stub_artist] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from("artists")
    .select("id")
    .eq("artist_key", artistKey)
    .limit(1)
    .single();
  if (selectError) throw new Error(`[playlist_stub_artist_select] ${selectError.message}`);

  const artistId = data?.id ? String(data.id) : null;

  if (artistId) {
    console.log("[debug][stubArtist] inserted", { artist_key: artistKey, name: cleaned });
  }

  return artistId;
}

async function linkFeaturedArtistTrack(artistId: string, trackId: string): Promise<void> {
  if (!artistId || !trackId) return;

  const row = {
    artist_id: artistId,
    track_id: trackId,
    role: "featured",
    created_at: nowIso(),
  };

  const { error } = await supabase
    .from("artist_tracks")
    .upsert(row, { onConflict: "artist_id,track_id", ignoreDuplicates: true });
  if (error) throw new Error(`[playlist_featured_link] ${error.message}`);

  console.log("[debug][featuredLink] linked", { track_id: trackId, artist_id: artistId });
}

function buildTrackInputs(
  tracks: PlaylistBrowse["tracks"],
  parentAlbum?: AlbumInput | null,
  parentPlaylist?: PlaylistInput | null
): BuiltTrack[] {
  return (tracks || [])
    .map((t: any) => {
      const externalId = getTrackVideoId(t);
      if (!externalId) return null;

      const videoId =
        normalize(t?.videoId ?? "") ||
        normalize((t as any)?.external_id ?? "") ||
        externalId;

      const imageUrl =
        extractBestImageUrl(t) ||
        extractBestImageUrl(parentAlbum) ||
        extractBestImageUrl(parentPlaylist) ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const artistNames = extractTrackArtistNames(t);

      console.log("[debug][trackImageFix]", {
        videoId,
        resolved: imageUrl,
      });

      const input: TrackInput = {
        externalId,
        title: normalize(t?.title) || "Untitled",
        durationSec: toSeconds(t?.duration ?? null),
        imageUrl,
        isVideo: true,
        source: "ingest",
      };

      return { input, artistNames, videoId } satisfies BuiltTrack;
    })
    .filter(Boolean) as BuiltTrack[];
}

function orderedTrackIds(tracks: PlaylistBrowse["tracks"], idMap: IdMap): string[] {
  return tracks
    .map((t: any) => getTrackVideoId(t))
    .filter(Boolean)
    .map((vid) => idMap[vid])
    .filter(Boolean);
}

async function ingestOne(
  artistId: string,
  input: AlbumInput | PlaylistInput,
  collectionMap: IdMap,
  kind: "album" | "playlist"
) {
  if (shouldSkipRadioMix(input.externalId)) return;

  const normalized = normalizePlaylistId(input.externalId);
  if (!normalized.valid) return;

  const browse = await browsePlaylistById(normalized.id);

  if (!browse?.tracks?.length) {
    console.info(`[phase3][${kind}] EMPTY`, {
      externalId: input.externalId,
      browseId: normalized.id,
    });
    return;
  }

  const parentAlbum = kind === "album" ? (input as AlbumInput) : null;
  const parentPlaylist = kind === "playlist" ? (input as PlaylistInput) : null;

  const builtTracks = buildTrackInputs(browse.tracks, parentAlbum, parentPlaylist);
  if (!builtTracks.length) return;

  const trackInputs = builtTracks.map((t) => t.input);

  console.log("[debug][upsertTracks] image_url sample:", trackInputs[0]?.imageUrl ?? null);

  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(browse.tracks, map);

  if (!ordered.length) return;

  if (kind === "playlist") {
    await Promise.all(
      builtTracks.map(async (t) => {
        const trackId = map[t.input.externalId];
        if (!trackId) return;

        for (const artistName of t.artistNames) {
          const artistId = await upsertStubArtist(artistName);
          if (!artistId) continue;
          await linkFeaturedArtistTrack(artistId, trackId);
        }
      })
    );
  }

  await linkArtistTracks(artistId, ordered);

  const collectionId = collectionMap[normalize(input.externalId)];

  if (collectionId) {
    if (kind === "album") await linkAlbumTracks(collectionId, ordered);
    if (kind === "playlist") await linkPlaylistTracks(collectionId, ordered);
  }

  console.info(`[phase3][${kind}] OK`, {
    externalId: input.externalId,
    fetchedTracks: browse.tracks.length,
    insertedTracks: ordered.length,
  });
}

export async function runPhase3Expansion(params: Phase3Input): Promise<Phase3Output> {
  const limiter = pLimit(CONCURRENCY);

  const albumTasks = params.albums.map((a) =>
    limiter(() => ingestOne(params.artistId, a, params.albumIdMap, "album"))
  );

  const playlistTasks = params.playlists.map((p) =>
    limiter(() =>
      ingestOne(params.artistId, p, params.playlistIdMap, "playlist")
    )
  );

  await Promise.all([...albumTasks, ...playlistTasks]);

  console.info("[phase3] expansion_complete", {
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
  });

  return {
    trackCount: 0,
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
  };
}
