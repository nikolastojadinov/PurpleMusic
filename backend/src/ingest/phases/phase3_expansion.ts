// target file: backend/src/ingest/phases/phase3_expansion.ts

import pLimit from "p-limit";
import supabase from "../../lib/supabase";
import { browsePlaylistById, type PlaylistBrowse } from "../../services/youtubeMusicClient";
import {
  linkAlbumTracks,
  linkPlaylistTracks,
  normalize,
  nowIso,
  toSeconds,
  type AlbumInput,
  type IdMap,
  type PlaylistInput,
  type TrackInput,
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
  albumExternalIds: string[];
  playlistExternalIds: string[];
};

export type Phase3Output = {
  trackCount: number;
  albumsProcessed: number;
  playlistsProcessed: number;
};

const CONCURRENCY = 3;

// ---------- helpers ----------

type ArtistRun = {
  name: string;
  artistKey: string;
  youtubeChannelId: string | null;
};

type BuiltTrack = {
  input: TrackInput;
  artistRuns: ArtistRun[];
  videoId: string;
};

function shouldSkipRadioMix(externalIdRaw: string): boolean {
  const upper = normalize(externalIdRaw).toUpperCase();
  return upper.includes("RDCLAK") || upper.startsWith("RD");
}

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

function canonicalArtistKey(name: string): string {
  const base = normalize(name)
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9_\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return base.replace(/\s+/g, "_").replace(/^_+|_+$/g, "") || "artist";
}

function extractPlaylistTrackArtists(rawItem: any): ArtistRun[] {
  const runs = rawItem?.shortBylineText?.runs;
  if (!runs || !Array.isArray(runs)) return [];

  const seen = new Set<string>();
  const artists: ArtistRun[] = [];

  runs.forEach((r: any) => {
    const name = typeof r?.text === "string" ? r.text.trim() : "";
    const browseIdRaw = r?.navigationEndpoint?.browseEndpoint?.browseId;
    const browseId = typeof browseIdRaw === "string" ? browseIdRaw.trim() : "";
    if (!name || !browseId) return;

    const artistKey = canonicalArtistKey(name);
    if (!artistKey || seen.has(artistKey)) return;
    seen.add(artistKey);

    const youtubeChannelId = browseId.startsWith("UC") ? browseId : null;
    artists.push({ name, artistKey, youtubeChannelId });
  });

  return artists;
}

async function upsertArtistAndGetId(run: ArtistRun): Promise<{ artistId: string | null; action: string }> {
  const name = normalize(run.name);
  const artistKey = normalize(run.artistKey);
  if (!name || !artistKey) return { artistId: null, action: "skip" };

  const now = nowIso();

  const { data: existing, error: selectError } = await supabase
    .from("artists")
    .select("id, display_name, youtube_channel_id, source")
    .eq("artist_key", artistKey)
    .limit(1)
    .maybeSingle();
  if (selectError) throw new Error(`[phase3][artist_select] ${selectError.message}`);

  if (!existing) {
    const insertRow = {
      artist_key: artistKey,
      name,
      display_name: name,
      youtube_channel_id: run.youtubeChannelId ?? null,
      source: "playlist_track",
      created_at: now,
      updated_at: now,
    };

    const { data: inserted, error: insertError } = await supabase
      .from("artists")
      .insert(insertRow)
      .select("id")
      .single();
    if (insertError) throw new Error(`[phase3][artist_insert] ${insertError.message}`);

    const artistId = inserted?.id ? String(inserted.id) : null;
    console.log("[phase3][artist-upsert]", { artist_key: artistKey, action: "insert", artist_id: artistId });
    return { artistId, action: "insert" };
  }

  const updates: Record<string, any> = { updated_at: now };

  if (!existing.display_name && name) {
    updates.display_name = name;
  }

  if (!existing.youtube_channel_id && run.youtubeChannelId) {
    updates.youtube_channel_id = run.youtubeChannelId;
  }

  if (!existing.source) {
    updates.source = "playlist_track";
  }

  const { data: updated, error: updateError } = await supabase
    .from("artists")
    .update(updates)
    .eq("artist_key", artistKey)
    .select("id")
    .single();
  if (updateError) throw new Error(`[phase3][artist_update] ${updateError.message}`);

  const artistId = updated?.id ? String(updated.id) : null;
  console.log("[phase3][artist-upsert]", { artist_key: artistKey, action: "update", artist_id: artistId });
  return { artistId, action: "update" };
}

async function linkArtistTrack(artistId: string, trackId: string, role: "primary" | "featured", artistKey: string) {
  if (!artistId || !trackId) return;

  const row = {
    artist_id: artistId,
    track_id: trackId,
    role,
    created_at: nowIso(),
  };

  const { data, error } = await supabase
    .from("artist_tracks")
    .upsert(row, { onConflict: "artist_id,track_id", ignoreDuplicates: true })
    .select("artist_id");

  if (error) throw new Error(`[phase3][artist_tracks] ${error.message}`);

  const action = data && data.length ? "insert" : "skip";
  console.log("[phase3][artist-tracks]", { trackId, artist_id: artistId, role, action, artist_key: artistKey });
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

      const videoId = normalize(t?.videoId ?? "") || normalize((t as any)?.external_id ?? "") || externalId;

      const imageUrl =
        extractBestImageUrl(t) ||
        extractBestImageUrl(parentAlbum) ||
        extractBestImageUrl(parentPlaylist) ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      const artistRuns = extractPlaylistTrackArtists(t);
      console.log("[phase3][artists] extracted", {
        trackId: externalId,
        artists: artistRuns.map((a) => ({
          name: a.name,
          artist_key: a.artistKey,
          youtube_channel_id: a.youtubeChannelId,
        })),
      });

      const input: TrackInput = {
        externalId,
        title: normalize(t?.title) || "Untitled",
        durationSec: toSeconds(t?.duration ?? null),
        imageUrl,
        isVideo: true,
        source: "ingest",
      };

      console.log("[debug][trackImageFix]", { videoId, resolved: imageUrl });

      return { input, artistRuns, videoId } satisfies BuiltTrack;
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

// ---------- ingest ----------

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
console.log(
  "[DUMP_TRACK_0]",
  JSON.stringify(browse.tracks?.[0], null, 2)
);

process.exit(0);
  if (!browse?.tracks?.length) {
    console.info(`[phase3][${kind}] EMPTY`, { externalId: input.externalId, browseId: normalized.id });
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

  await Promise.all(
    builtTracks.map(async (t) => {
      const trackId = map[t.input.externalId];
      if (!trackId) return;

      if (!t.artistRuns.length) {
        console.log("[phase3][artists] extracted", { trackId: t.input.externalId, artists: [] });
        return;
      }

      const primary = t.artistRuns[0];
      const featured = kind === "playlist" ? t.artistRuns.slice(1) : [];

      const { artistId: primaryId } = await upsertArtistAndGetId(primary);
      if (primaryId) await linkArtistTrack(primaryId, trackId, "primary", primary.artistKey);

      for (const feat of featured) {
        const { artistId: featId } = await upsertArtistAndGetId(feat);
        if (featId) await linkArtistTrack(featId, trackId, "featured", feat.artistKey);
      }
    })
  );

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
    limiter(() => ingestOne(params.artistId, p, params.playlistIdMap, "playlist"))
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
