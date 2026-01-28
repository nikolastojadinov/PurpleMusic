import supabase from '../lib/supabase';

export type NormalizedArtist = {
  key: string;
  displayName: string;
  channelId: string | null;
};

export type TrackInput = {
  youtubeId: string;
  title: string;
  artistNames: string[];
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  albumExternalId?: string | null;
  isVideo?: boolean;
  source?: string;
  isExplicit?: boolean | null;
};

export type AlbumInput = {
  externalId: string;
  title: string;
  thumbnailUrl: string | null;
  releaseDate: string | null;
  albumType: string | null;
  artistKey: string | null;
  trackCount?: number | null;
};

export type PlaylistInput = {
  externalId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  channelId: string | null;
  itemCount?: number | null;
};

export type IdMap = Record<string, string>;

export function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function canonicalArtistKey(name: string, channelId?: string | null): string {
  const base = normalize(name).toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '');
  const compact = base.replace(/\s+/g, '-');
  if (compact && channelId) return `${compact}-${normalize(channelId).toLowerCase()}`;
  if (compact) return compact;
  return (normalize(channelId) || 'artist').toLowerCase();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  values.forEach((v) => {
    const n = normalize(v).toLowerCase();
    if (!n || seen.has(n)) return;
    seen.add(n);
    result.push(n);
  });
  return result;
}

export function toSeconds(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  const value = normalize(raw);
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const parts = value.split(':').map((p) => Number.parseInt(p, 10)).filter((n) => Number.isFinite(n));
  if (!parts.length) return null;
  return parts.reduce((acc, cur) => acc * 60 + cur, 0);
}

export async function upsertArtist(row: {
  artist_key: string;
  display_name: string;
  artist: string;
  youtube_channel_id: string | null;
  artist_description?: string | null;
  thumbnails?: any;
}): Promise<void> {
  const payload = {
    ...row,
    normalized_name: normalize(row.artist),
    updated_at: nowIso(),
    created_at: nowIso(),
    source: 'ingest',
  };

  const { error } = await supabase.from('artists').upsert(payload, { onConflict: 'artist_key' });
  if (error) throw new Error(`[artist_upsert] ${error.message}`);
}

export async function upsertAlbums(inputs: AlbumInput[]): Promise<{ map: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, count: 0 };
  const rows = inputs
    .map((a) => ({
      external_id: normalize(a.externalId),
      title: normalize(a.title) || 'Album',
      thumbnail_url: a.thumbnailUrl,
      release_date: a.releaseDate,
      album_type: a.albumType,
      artist_key: a.artistKey,
      track_count: a.trackCount ?? null,
      updated_at: nowIso(),
    }))
    .filter((r) => Boolean(r.external_id));

  if (!rows.length) return { map: {}, count: 0 };
  const { error } = await supabase.from('albums').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[album_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('albums')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[album_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    if (row?.external_id && row?.id) map[row.external_id] = row.id;
  });
  return { map, count: rows.length };
}

export async function upsertPlaylists(inputs: PlaylistInput[]): Promise<{ map: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((p) => ({
      external_id: normalize(p.externalId),
      title: normalize(p.title) || 'Playlist',
      description: p.description,
      cover_url: p.thumbnailUrl,
      image_url: p.thumbnailUrl,
      channel_id: normalize(p.channelId) || null,
      item_count: p.itemCount ?? null,
      is_public: true,
      validated: true,
      validated_on: now,
      last_refreshed_on: now,
      updated_at: now,
    }))
    .filter((r) => Boolean(r.external_id));

  if (!rows.length) return { map: {}, count: 0 };
  const { error } = await supabase.from('playlists').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[playlist_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('playlists')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[playlist_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    if (row?.external_id && row?.id) map[row.external_id] = row.id;
  });
  return { map, count: rows.length };
}

export async function upsertTracks(inputs: TrackInput[], albumMap: IdMap): Promise<{ idMap: IdMap; count: number }>
{
  if (!inputs.length) return { idMap: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((t) => {
      const youtubeId = normalize(t.youtubeId);
      if (!youtubeId) return null;
      const primaryArtist = normalize(t.artistNames[0]);
      const albumId = t.albumExternalId ? albumMap[normalize(t.albumExternalId)] ?? null : null;
      return {
        youtube_id: youtubeId,
        external_id: youtubeId,
        title: normalize(t.title) || 'Untitled',
        artist: primaryArtist || 'Unknown artist',
        artist_key: primaryArtist || null,
        duration: t.durationSeconds ?? null,
        cover_url: t.thumbnailUrl,
        image_url: t.thumbnailUrl,
        album_id: albumId,
        last_synced_at: now,
        last_updated_at: now,
        is_video: Boolean(t.isVideo),
        source: normalize(t.source) || 'ingest',
        sync_status: 'fetched',
        is_explicit: t.isExplicit ?? null,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return { idMap: {}, count: 0 };
  const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'youtube_id' });
  if (error) throw new Error(`[track_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('tracks')
    .select('id, youtube_id')
    .in('youtube_id', rows.map((r) => r.youtube_id));
  if (selectError) throw new Error(`[track_upsert_select] ${selectError.message}`);

  const idMap: IdMap = {};
  (data || []).forEach((row: any) => {
    if (row?.youtube_id && row?.id) idMap[row.youtube_id] = row.id;
  });

  return { idMap, count: rows.length };
}

export async function linkAlbumTracks(albumId: string, trackIds: string[]): Promise<number> {
  if (!albumId || !trackIds.length) return 0;
  const rows = trackIds.map((trackId, index) => ({ album_id: albumId, track_id: trackId, position: index + 1 }));
  const { error } = await supabase.from('album_tracks').upsert(rows, { onConflict: 'album_id,track_id' });
  if (error) throw new Error(`[album_tracks] ${error.message}`);
  return rows.length;
}

export async function linkPlaylistTracks(playlistId: string, trackIds: string[]): Promise<number> {
  if (!playlistId || !trackIds.length) return 0;
  const rows = trackIds.map((trackId, index) => ({ playlist_id: playlistId, track_id: trackId, position: index + 1 }));
  const { error } = await supabase.from('playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id' });
  if (error) throw new Error(`[playlist_tracks] ${error.message}`);
  return rows.length;
}

export async function linkArtistTracks(artistKey: string, trackIds: string[]): Promise<number> {
  if (!artistKey || !trackIds.length) return 0;
  const rows = trackIds.map((trackId) => ({ artist_key: artistKey, track_id: trackId }));
  const { error } = await supabase.from('artist_tracks').upsert(rows, { onConflict: 'artist_key,track_id' });
  if (error) throw new Error(`[artist_tracks] ${error.message}`);
  return rows.length;
}

export async function linkArtistPlaylists(artistKey: string, playlistIds: string[]): Promise<number> {
  if (!artistKey || !playlistIds.length) return 0;
  const rows = playlistIds.map((playlistId) => ({ artist_key: artistKey, playlist_id: playlistId }));
  const { error } = await supabase.from('artist_playlists').upsert(rows, { onConflict: 'artist_key,playlist_id' });
  if (error) throw new Error(`[artist_playlists] ${error.message}`);
  return rows.length;
}

export function safeIdMapFromIds(rows: Array<{ id: string; external_id?: string; youtube_id?: string }>, keyField: 'external_id' | 'youtube_id') {
  const map: IdMap = {};
  rows.forEach((row) => {
    const key = normalize(row[keyField]);
    if (row.id && key) map[key] = row.id;
  });
  return map;
}
