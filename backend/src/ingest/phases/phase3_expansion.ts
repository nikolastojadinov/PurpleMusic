// target file: backend/src/ingest/phases/phase3_expansion.ts

// PORTED FROM legacy hajde-music-stream:
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/ingestPlaylistOrAlbum.ts
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/youtubeMusicClient.ts
// function(s): ingestPlaylistOrAlbum, browsePlaylistById

import pLimit from 'p-limit';
import { browsePlaylistById, type PlaylistBrowse } from '../../ytmusic/innertubeClient';
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
} from '../utils';

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

function shouldSkipRadioMix(externalIdRaw: string): boolean {
  const externalId = normalize(externalIdRaw).toUpperCase();
  return externalId.includes('RDCLAK') || externalId.startsWith('RD');
}

function normalizePlaylistId(externalIdRaw: string): { valid: boolean; id: string } {
  const externalId = normalize(externalIdRaw);
  if (!externalId) return { valid: false, id: '' };

  const upper = externalId.toUpperCase();

  if (upper.startsWith('VLPL')) return { valid: true, id: externalId };
  if (upper.startsWith('MPRE')) return { valid: true, id: externalId };
  if (upper.startsWith('OLAK5UY')) return { valid: true, id: externalId };

  // Plain playlist ids should be prefixed with VL for browse.
  if (upper.startsWith('PL')) return { valid: true, id: `VL${upper}` };

  return { valid: false, id: '' };
}

function pickBestThumbnail(thumbnails?: any): string | null {
  const arr = Array.isArray(thumbnails) ? thumbnails : thumbnails?.thumbnails;
  if (!Array.isArray(arr) || arr.length === 0) return null;

  const scored = arr
    .map((t: any) => {
      const url = normalize(t?.url);
      if (!url) return null;
      const w = Number(t?.width) || 0;
      const h = Number(t?.height) || 0;
      const score = w && h ? w * h : w || h || 1;
      return { url, score };
    })
    .filter(Boolean) as Array<{ url: string; score: number }>;

  if (!scored.length) return null;
  scored.sort((a, b) => b.score - a.score);
  return scored[0].url;
}

/**
 * Robust videoId extractor for Innertube/YTMusic responses.
 * We MUST not assume `t.videoId` exists.
 */
function getTrackVideoId(t: any): string {
  const direct =
    t?.videoId ??
    t?.video_id ??
    t?.id ??
    t?.video?.videoId ??
    t?.video?.id ??
    t?.track?.videoId ??
    t?.track?.id;

  const fromNav =
    t?.navigationEndpoint?.watchEndpoint?.videoId ??
    t?.navigationEndpoint?.watchEndpoint?.playlistId ??
    t?.onTap?.watchEndpoint?.videoId ??
    t?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;

  const fromFlex =
    t?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ??
    t?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.playlistId;

  // Prefer explicit videoId-like value
  const picked = direct ?? fromNav ?? fromFlex ?? '';
  return normalize(picked);
}

function buildTrackInputs(tracks: PlaylistBrowse['tracks'], _source: 'album' | 'playlist'): TrackInput[] {
  return (tracks || [])
    .map((t: any) => {
      const externalId = getTrackVideoId(t);
      if (!externalId) return null;

      return {
        externalId,
        title: normalize(t?.title) || normalize(t?.name) || 'Untitled',
        artist: normalize(t?.artist) || normalize(t?.artists?.[0]?.name) || null,
        durationSec: toSeconds(t?.duration ?? t?.length ?? null),
        imageUrl: pickBestThumbnail(t?.thumbnail ?? t?.thumbnails ?? t?.albumCover ?? null),
        isVideo: true,
        source: 'ingest',
      } as TrackInput;
    })
    .filter(Boolean) as TrackInput[];
}

function orderedTrackIds(tracks: PlaylistBrowse['tracks'], idMap: IdMap): string[] {
  return (tracks || [])
    .map((t: any) => getTrackVideoId(t))
    .filter(Boolean)
    .map((vid) => idMap[vid])
    .filter(Boolean);
}

async function ingestAlbum(
  artistId: string,
  album: AlbumInput,
  albumIdMap: IdMap
): Promise<{ fetched: number; inserted: number; linked: number }> {
  if (shouldSkipRadioMix(album.externalId)) {
    console.warn('[phase3] skipping radio mix playlist', { externalId: album.externalId });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const normalized = normalizePlaylistId(album.externalId);
  if (!normalized.valid) {
    console.warn('[phase3] skipping unsupported playlist id', { externalId: album.externalId });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const browseId = normalized.id;
  const browse = await browsePlaylistById(browseId);

  const tracksArr = Array.isArray((browse as any)?.tracks) ? ((browse as any).tracks as any[]) : [];
  if (!tracksArr.length) {
    console.info('[phase3][album]', {
      externalId: album.externalId,
      fetchedTracks: 0,
      insertedTracks: 0,
      linkedAlbumTracks: 0,
      browseId,
    });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const trackInputs = buildTrackInputs(tracksArr as any, 'album');
  if (!trackInputs.length) {
    console.info('[phase3][album]', {
      externalId: album.externalId,
      fetchedTracks: tracksArr.length,
      insertedTracks: 0,
      linkedAlbumTracks: 0,
      browseId,
      note: 'tracks exist but none had a usable videoId',
    });
    return { fetched: tracksArr.length, inserted: 0, linked: 0 };
  }

  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(tracksArr as any, map);

  const albumId = albumIdMap[normalize(browseId)];
  let linkedAlbumTracks = 0;
  if (albumId && ordered.length) {
    linkedAlbumTracks = await linkAlbumTracks(albumId, ordered);
  }

  let linkedArtistTracks = 0;
  if (ordered.length) {
    linkedArtistTracks = await linkArtistTracks(artistId, ordered);
  }

  console.info('[phase3][album]', {
    externalId: album.externalId,
    fetchedTracks: tracksArr.length,
    insertedTracks: ordered.length,
    linkedAlbumTracks,
    browseId,
  });

  return { fetched: tracksArr.length, inserted: ordered.length, linked: linkedAlbumTracks + linkedArtistTracks };
}

async function ingestPlaylist(
  artistId: string,
  playlist: PlaylistInput,
  playlistIdMap: IdMap
): Promise<{ fetched: number; inserted: number; linked: number }> {
  if (shouldSkipRadioMix(playlist.externalId)) {
    console.warn('[phase3] skipping radio mix playlist', { externalId: playlist.externalId });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const normalized = normalizePlaylistId(playlist.externalId);
  if (!normalized.valid) {
    console.warn('[phase3] skipping unsupported playlist id', { externalId: playlist.externalId });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const browseId = normalized.id;
  const browse = await browsePlaylistById(browseId);

  const tracksArr = Array.isArray((browse as any)?.tracks) ? ((browse as any).tracks as any[]) : [];
  if (!tracksArr.length) {
    console.info('[phase3][playlist]', {
      externalId: playlist.externalId,
      fetchedTracks: 0,
      insertedTracks: 0,
      linkedPlaylistTracks: 0,
      browseId,
    });
    return { fetched: 0, inserted: 0, linked: 0 };
  }

  const trackInputs = buildTrackInputs(tracksArr as any, 'playlist');
  if (!trackInputs.length) {
    console.info('[phase3][playlist]', {
      externalId: playlist.externalId,
      fetchedTracks: tracksArr.length,
      insertedTracks: 0,
      linkedPlaylistTracks: 0,
      browseId,
      note: 'tracks exist but none had a usable videoId',
    });
    return { fetched: tracksArr.length, inserted: 0, linked: 0 };
  }

  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(tracksArr as any, map);

  const playlistId = playlistIdMap[normalize(playlist.externalId)];
  let linkedPlaylistTracks = 0;
  if (playlistId && ordered.length) {
    linkedPlaylistTracks = await linkPlaylistTracks(playlistId, ordered);
  }

  let linkedArtistTracks = 0;
  if (ordered.length) {
    linkedArtistTracks = await linkArtistTracks(artistId, ordered);
  }

  console.info('[phase3][playlist]', {
    externalId: playlist.externalId,
    fetchedTracks: tracksArr.length,
    insertedTracks: ordered.length,
    linkedPlaylistTracks,
    browseId,
  });

  return { fetched: tracksArr.length, inserted: ordered.length, linked: linkedPlaylistTracks + linkedArtistTracks };
}

export async function runPhase3Expansion(params: Phase3Input): Promise<Phase3Output> {
  const limiter = pLimit(CONCURRENCY);

  const albumTasks = params.albums.map((album) =>
    limiter(() => ingestAlbum(params.artistId, album, params.albumIdMap))
  );
  const playlistTasks = params.playlists.map((playlist) =>
    limiter(() => ingestPlaylist(params.artistId, playlist, params.playlistIdMap))
  );

  const albumResults = await Promise.all(albumTasks);
  const playlistResults = await Promise.all(playlistTasks);

  let totalFetchedTracks = 0;
  let totalTracksInserted = 0;

  albumResults.forEach((r) => {
    totalFetchedTracks += r.fetched;
    totalTracksInserted += r.inserted;
  });
  playlistResults.forEach((r) => {
    totalFetchedTracks += r.fetched;
    totalTracksInserted += r.inserted;
  });

  if (params.topSongs?.length) {
    // Keep existing behavior, but it now benefits from robust IDs too if TrackInput is correct upstream.
    const { map } = await upsertTracks(params.topSongs);
    const ids = Object.values(map);
    if (ids.length) {
      await linkArtistTracks(params.artistId, ids);
      totalTracksInserted += ids.length;
    }
  }

  console.info('[phase3] expansion_complete', {
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
    totalFetchedTracks,
    totalTracksInserted,
  });

  return {
    trackCount: totalTracksInserted,
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
  };
}
