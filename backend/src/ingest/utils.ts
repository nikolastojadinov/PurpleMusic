import supabase from '../lib/supabase';

export type ArtistInput = {
  artistKey: string;
  name: string;
  displayName?: string | null;
  youtubeChannelId?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  thumbnails?: any;
  subscriberCount?: number | null;
  viewCount?: number | null;
  source?: string | null;
};

export type AlbumInput = {
  externalId: string;
  title: string;
  albumType?: 'album' | 'single' | 'ep' | null;
  releaseDate?: string | null;
  coverUrl?: string | null;
  thumbnails?: any;
  source?: string | null;
};

export type TrackInput = {
  externalId: string;
  title: string;
  durationSec?: number | null;
  publishedAt?: string | null;
  viewCount?: number | null;
  likeCount?: number | null;
  isVideo?: boolean;
  imageUrl?: string | null;
  source?: string | null;
};

export type PlaylistInput = {
  externalId: string;
  title: string;
  description?: string | null;
  coverUrl?: string | null;
  playlistType?: 'artist' | 'user' | 'editorial' | null;
  source?: string | null;
};

export type IdMap = Record<string, string>;

export function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertArtist(input: ArtistInput): Promise<{ id: string; artistKey: string }> {
  const artistKey = normalize(input.artistKey);
  if (!artistKey) throw new Error('[artist_upsert] artistKey is required');

  const payload = {
    artist_key: artistKey,
    name: normalize(input.name) || artistKey,
    display_name: normalize(input.displayName) || normalize(input.name) || artistKey,
    youtube_channel_id: normalize(input.youtubeChannelId) || null,
    description: normalize(input.description) || null,
    image_url: normalize(input.imageUrl) || null,
    thumbnails: input.thumbnails ?? null,
    subscriber_count: input.subscriberCount ?? null,
    view_count: input.viewCount ?? null,
    source: normalize(input.source) || 'ingest',
    updated_at: nowIso(),
  };

  const { data, error } = await supabase
    .from('artists')
    .upsert(payload, { onConflict: 'artist_key' })
    .select('id, artist_key')
    .maybeSingle();

  if (error) throw new Error(`[artist_upsert] ${error.message}`);
  if (!data?.id) throw new Error('[artist_upsert] upsert returned no id');

  return { id: data.id as string, artistKey: data.artist_key as string };
}

export async function upsertAlbums(inputs: AlbumInput[], artistId: string): Promise<{ map: IdMap; count: number }> {
  if (!artistId || !inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((a) => {
      const externalId = normalize(a.externalId);
      if (!externalId) return null;
      return {
        external_id: externalId,
        artist_id: artistId,
        title: normalize(a.title) || externalId,
        album_type: a.albumType ?? null,
        release_date: a.releaseDate || null,
        cover_url: a.coverUrl ?? null,
        thumbnails: a.thumbnails ?? null,
        source: normalize(a.source) || 'ingest',
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

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
    const key = normalize(row?.external_id);
    if (row?.id && key) map[key] = row.id;
  });

  return { map, count: rows.length };
}

export async function upsertPlaylists(inputs: PlaylistInput[]): Promise<{ map: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((p) => {
      const externalId = normalize(p.externalId);
      if (!externalId) return null;
      return {
        external_id: externalId,
        title: normalize(p.title) || externalId,
        description: normalize(p.description) || null,
        cover_url: p.coverUrl ?? null,
        playlist_type: 'artist',
        source: normalize(p.source) || 'ingest',
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

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
    const key = normalize(row?.external_id);
    if (row?.id && key) map[key] = row.id;
  });

  return { map, count: rows.length };
}

export async function upsertTracks(inputs: TrackInput[]): Promise<{ map: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((t) => {
      const externalId = normalize(t.externalId);
      if (!externalId) return null;
      return {
        external_id: externalId,
        title: normalize(t.title) || externalId,
        duration_sec: t.durationSec ?? null,
        published_at: t.publishedAt ?? null,
        view_count: t.viewCount ?? null,
        like_count: t.likeCount ?? null,
        is_video: Boolean(t.isVideo),
        image_url: t.imageUrl ?? null,
        source: normalize(t.source) || 'ingest',
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return { map: {}, count: 0 };

  const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[track_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('tracks')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[track_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    const key = normalize(row?.external_id);
    if (row?.id && key) map[key] = row.id;
  });

  return { map, count: rows.length };
}

export async function linkAlbumTracks(albumId: string, trackIds: string[]): Promise<number> {
  if (!albumId || !trackIds.length) return 0;
  const rows = trackIds.map((trackId, index) => ({
    album_id: albumId,
    track_id: trackId,
    position: index + 1,
    created_at: nowIso(),
  }));
  const { error } = await supabase.from('album_tracks').upsert(rows, { onConflict: 'album_id,track_id' });
  if (error) throw new Error(`[album_tracks] ${error.message}`);
  return rows.length;
}

export async function linkPlaylistTracks(playlistId: string, trackIds: string[]): Promise<number> {
  if (!playlistId || !trackIds.length) return 0;
  const rows = trackIds.map((trackId, index) => ({
    playlist_id: playlistId,
    track_id: trackId,
    position: index + 1,
    added_at: nowIso(),
  }));
  const { error } = await supabase.from('playlist_tracks').upsert(rows, { onConflict: 'playlist_id,track_id' });
  if (error) throw new Error(`[playlist_tracks] ${error.message}`);
  return rows.length;
}

export async function linkArtistTracks(artistId: string, trackIds: string[]): Promise<number> {
  if (!artistId || !trackIds.length) return 0;
  const rows = trackIds.map((trackId, index) => ({
    artist_id: artistId,
    track_id: trackId,
    role: 'primary',
    position: index + 1,
    created_at: nowIso(),
  }));
  const { error } = await supabase.from('artist_tracks').upsert(rows, { onConflict: 'artist_id,track_id' });
  if (error) throw new Error(`[artist_tracks] ${error.message}`);
  return rows.length;
}

export async function linkArtistPlaylists(artistId: string, playlistIds: string[]): Promise<number> {
  if (!artistId || !playlistIds.length) return 0;
  const rows = playlistIds.map((playlistId) => ({
    artist_id: artistId,
    playlist_id: playlistId,
    role: 'primary',
    created_at: nowIso(),
  }));
  const { error } = await supabase.from('artist_playlists').upsert(rows, { onConflict: 'artist_id,playlist_id' });
  if (error) throw new Error(`[artist_playlists] ${error.message}`);
  return rows.length;
}
