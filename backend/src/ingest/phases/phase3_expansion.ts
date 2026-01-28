// target file: backend/src/ingest/phases/phase3_expansion.ts

import pLimit from "p-limit";

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
  upsertTracks,
  type AlbumInput,
  type PlaylistInput,
  type TrackInput,
  type IdMap,
} from "../utils";

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

function pickBestThumbnail(thumbnails?: any): string | null {
  const arr = Array.isArray(thumbnails) ? thumbnails : thumbnails?.thumbnails;
  if (!Array.isArray(arr) || arr.length === 0) return null;

  arr.sort(
    (a: any, b: any) =>
      (b.width ?? 0) * (b.height ?? 0) - (a.width ?? 0) * (a.height ?? 0)
  );

  return normalize(arr[0]?.url) || null;
}

function getTrackVideoId(t: any): string {
  return normalize(t?.videoId ?? "");
}

/**
 * Build TrackInput objects (STRICTLY matching your TrackInput type).
 */
function buildTrackInputs(tracks: PlaylistBrowse["tracks"]): TrackInput[] {
  return (tracks || [])
    .map((t: any) => {
      const externalId = getTrackVideoId(t);
      if (!externalId) return null;

      return {
        externalId,
        title: normalize(t?.title) || "Untitled",
        durationSec: toSeconds(t?.duration ?? null),
        imageUrl: pickBestThumbnail(t?.thumbnail ?? null),
        isVideo: true,
        source: "ingest",
      } satisfies TrackInput;
    })
    .filter(Boolean) as TrackInput[];
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

  const trackInputs = buildTrackInputs(browse.tracks);
  if (!trackInputs.length) return;

  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(browse.tracks, map);

  if (!ordered.length) return;

  // always link tracks to artist
  await linkArtistTracks(artistId, ordered);

  // ✅ FIX: map lookup must use externalId, not browseId
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
