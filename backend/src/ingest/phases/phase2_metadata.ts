import supabase from '../../lib/supabase';
import { linkArtistPlaylists, linkArtistTracks, normalize, nowIso, toSeconds, upsertAlbums, upsertPlaylists, upsertTracks } from '../utils';
import type { ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase2Album = {
  externalId: string;
  title: string;
  coverUrl: string | null;
  albumType: 'album' | 'single' | 'ep';
  trackCount: number | null;
};

export type Phase2Playlist = {
  externalId: string;
  title: string;
  coverUrl: string | null;
};

export type Phase2Output = {
  artistKey: string;
  artistId: string;
  browseId: string;
  albums: Phase2Album[];
  playlists: Phase2Playlist[];
  topTrackIds: string[];
  albumIdMap: Record<string, string>;
  playlistIdMap: Record<string, string>;
};

function pickAlbumType(trackCount: number | null | undefined): 'album' | 'single' | 'ep' {
  if (!Number.isFinite(trackCount)) return 'album';
  const count = Number(trackCount);
  if (count <= 3) return 'single';
  if (count <= 6) return 'ep';
  return 'album';
}

function pickCoverUrl(thumbnail: string | null | undefined): string | null {
  const normalized = normalize(thumbnail);
  return normalized || null;
}

function uniqueByExternalId<T extends { externalId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) =>
    item.externalId && !seen.has(item.externalId) ? (seen.add(item.externalId), result.push(item)) : null,
  );
  return result;
}

async function ingestArtistDescriptionIfEmpty(artistKey: string, description: string | null): Promise<boolean> {
  const trimmed = normalize(description);
  if (!trimmed) return false;
  const { data, error } = await supabase
    .from('artists')
    .update({ description: trimmed, updated_at: nowIso() })
    .eq('artist_key', artistKey)
    .is('description', null)
    .select('artist_key')
    .maybeSingle();
  if (error) throw new Error(`[artist_description] ${error.message}`);
  return Boolean(data?.artist_key);
}

async function ingestTopSongs(artistId: string, browse: ArtistBrowse): Promise<string[]> {
  const tracks = (browse.topSongs || []).map((t) => ({
    externalId: t.videoId,
    title: t.title,
    durationSec: toSeconds(t.duration),
    imageUrl: t.thumbnail,
    isVideo: true,
    source: 'artist_top_song',
  }));
  const { map } = await upsertTracks(tracks);
  const trackIds = Object.values(map);
  if (trackIds.length) await linkArtistTracks(artistId, trackIds);
  return trackIds;
}

async function ingestArtistAlbums(artistId: string, browse: ArtistBrowse) {
  const albums: Phase2Album[] = uniqueByExternalId(
    (browse.albums || []).map((a) => ({
      externalId: normalize(a.id),
      title: a.title,
      coverUrl: pickCoverUrl(a.thumbnail),
      albumType: pickAlbumType(a.trackCount ?? null),
      trackCount: a.trackCount ?? null,
    })),
  ).filter((a) => Boolean(a.externalId));

  const { map } = await upsertAlbums(albums, artistId);
  return { albums, albumIdMap: map };
}

async function ingestArtistPlaylists(artistId: string, browse: ArtistBrowse) {
  const playlists: Phase2Playlist[] = uniqueByExternalId(
    (browse.playlists || []).map((p) => ({
      externalId: normalize(p.id),
      title: p.title,
      coverUrl: pickCoverUrl(p.thumbnail),
    })),
  ).filter((p) => Boolean(p.externalId));

  const { map } = await upsertPlaylists(playlists);
  const playlistIds = Object.values(map);
  if (playlistIds.length) await linkArtistPlaylists(artistId, playlistIds);
  return { playlists, playlistIdMap: map };
}

export async function runPhase2Metadata(params: {
  artistId: string;
  artistKey: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
}): Promise<Phase2Output> {
  const started = Date.now();
  console.info('[ingest][phase2_metadata] phase_start', { artist_key: params.artistKey, browse_id: params.browseId, at: nowIso() });

  const descPromise = ingestArtistDescriptionIfEmpty(params.artistKey, params.artistBrowse.description);
  const topSongsPromise = ingestTopSongs(params.artistId, params.artistBrowse);
  const albumPromise = ingestArtistAlbums(params.artistId, params.artistBrowse);
  const playlistPromise = ingestArtistPlaylists(params.artistId, params.artistBrowse);

  const [descResult, topSongsResult, albumResult, playlistResult] = await Promise.allSettled([
    descPromise,
    topSongsPromise,
    albumPromise,
    playlistPromise,
  ]);

  const albums = albumResult.status === 'fulfilled' ? albumResult.value.albums : [];
  const playlists = playlistResult.status === 'fulfilled' ? playlistResult.value.playlists : [];
  const topTrackIds = topSongsResult.status === 'fulfilled' ? topSongsResult.value : [];
  const albumIdMap = albumResult.status === 'fulfilled' ? albumResult.value.albumIdMap : {};
  const playlistIdMap = playlistResult.status === 'fulfilled' ? playlistResult.value.playlistIdMap : {};

  const duration = Date.now() - started;
  console.info('[ingest][phase2_metadata] phase_complete', {
    artist_key: params.artistKey,
    browse_id: params.browseId,
    duration_ms: duration,
    albums: albums.length,
    playlists: playlists.length,
    top_tracks: topTrackIds.length,
    description_written: descResult.status === 'fulfilled' ? descResult.value : false,
  });

  return {
    artistKey: params.artistKey,
    artistId: params.artistId,
    browseId: params.browseId,
    albums,
    playlists,
    topTrackIds,
    albumIdMap,
    playlistIdMap,
  };
}

