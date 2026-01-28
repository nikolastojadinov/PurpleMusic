import supabase from '../../lib/supabase';
import { linkArtistPlaylists, linkArtistTracks, normalize, nowIso, toSeconds, upsertAlbums, upsertPlaylists, upsertTracks } from '../utils';
import type { ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase2Output = {
  artistKey: string;
  browseId: string;
  albums: Array<{ externalId: string; title: string; thumbnailUrl: string | null; releaseDate: string | null; trackCount: number | null }>;
  playlists: Array<{ externalId: string; title: string; thumbnailUrl: string | null }>;
  topTrackIds: string[];
  albumIdMap: Record<string, string>;
  playlistIdMap: Record<string, string>;
};

async function ingestArtistDescriptionIfEmpty(artistKey: string, description: string | null): Promise<boolean> {
  const trimmed = normalize(description);
  if (!trimmed) return false;
  const { data, error } = await supabase
    .from('artists')
    .update({ artist_description: trimmed, updated_at: nowIso() })
    .eq('artist_key', artistKey)
    .is('artist_description', null)
    .select('artist_key')
    .maybeSingle();
  if (error) throw new Error(`[artist_description] ${error.message}`);
  return Boolean(data?.artist_key);
}

async function ingestTopSongs(artistKey: string, browse: ArtistBrowse): Promise<string[]> {
  const tracks = (browse.topSongs || []).map((t) => ({
    youtubeId: t.videoId,
    title: t.title,
    artistNames: [browse.name || artistKey],
    durationSeconds: toSeconds(t.duration),
    thumbnailUrl: t.thumbnail,
    isVideo: true,
    source: 'artist_top_song',
  }));
  const { idMap } = await upsertTracks(tracks, {});
  const trackIds = Object.values(idMap);
  if (trackIds.length) await linkArtistTracks(artistKey, trackIds);
  return trackIds;
}

async function ingestArtistAlbums(artistKey: string, browse: ArtistBrowse) {
  const albums = (browse.albums || []).map((a) => ({
    externalId: a.id,
    title: a.title,
    thumbnailUrl: a.thumbnail,
    releaseDate: a.year ? `${a.year}-01-01` : null,
    albumType: null,
    artistKey,
    trackCount: a.trackCount ?? null,
  }));
  const { map } = await upsertAlbums(albums);
  return { albums, albumIdMap: map };
}

async function ingestArtistPlaylists(artistKey: string, browse: ArtistBrowse) {
  const playlists = (browse.playlists || []).map((p) => ({
    externalId: p.id,
    title: p.title,
    description: null,
    thumbnailUrl: p.thumbnail,
    channelId: browse.channelId,
    itemCount: null,
  }));
  const { map } = await upsertPlaylists(playlists);
  if (Object.values(map).length) await linkArtistPlaylists(artistKey, Object.values(map));
  return { playlists, playlistIdMap: map };
}

export async function runPhase2Metadata(params: { artistKey: string; browseId: string; artistBrowse: ArtistBrowse }): Promise<Phase2Output> {
  const started = Date.now();
  console.info('[ingest][phase2_metadata] phase_start', { artist_key: params.artistKey, browse_id: params.browseId, at: nowIso() });

  const descPromise = ingestArtistDescriptionIfEmpty(params.artistKey, params.artistBrowse.description);
  const topSongsPromise = ingestTopSongs(params.artistKey, params.artistBrowse);
  const albumPromise = ingestArtistAlbums(params.artistKey, params.artistBrowse);
  const playlistPromise = ingestArtistPlaylists(params.artistKey, params.artistBrowse);

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

  return { artistKey: params.artistKey, browseId: params.browseId, albums, playlists, topTrackIds, albumIdMap, playlistIdMap };
}
