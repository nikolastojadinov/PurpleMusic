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
  thumbnails?: any;
  playlistType?: 'artist' | 'user' | 'editorial' | null;
  source?: string | null;
};

export type IdMap = Record<string, string>;

const DEFAULT_SOURCE = 'ingest';

export function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalArtistKeyFromName(name: string): string {
  const base = normalize(name).toLowerCase();
  const collapsed = base.replace(/\s+/g, '_');
  return collapsed || 'artist';
}

export function canonicalArtistKey(name: string): string {
  return canonicalArtistKeyFromName(name);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function toSeconds(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.floor(raw);
  const value = normalize(raw);
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number.parseInt(value, 10);
  const parts = value
    .split(':')
    .map((p) => Number.parseInt(p, 10))
    .filter((n) => Number.isFinite(n));
  if (!parts.length) return null;
  return parts.reduce((acc, cur) => acc * 60 + cur, 0);
}

function coalesceUrl(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const candidate = normalize(value);
    if (candidate) return candidate;
  }
  return null;
}

function pickBestThumbnail(thumbnails: any): string | null {
  const arr = Array.isArray(thumbnails) ? thumbnails : thumbnails?.thumbnails;
  if (!Array.isArray(arr) || !arr.length) return null;
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

function bestCoverFromInput(coverUrl?: string | null, thumbnails?: any): string | null {
  return coalesceUrl(coverUrl, pickBestThumbnail(thumbnails));
}

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  ids.forEach((id) => {
    const normalized = normalize(id);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  });
  return ordered;
}

function mapExternalId(row: { external_id: string; id?: string | null }): { key: string; id: string | null } {
  const key = normalize(row?.external_id);
  const id = row?.id ? String(row.id) : null;
  return { key, id };
}

async function fillMissingCovers(
  table: 'albums' | 'playlists',
  rows: Array<{ external_id: string; cover_url: string | null; thumbnails?: any }>,
): Promise<void> {
  const candidates = rows.filter((r) => Boolean(r.cover_url));
  if (!candidates.length) return;

  for (const row of candidates) {
    const payload: Record<string, any> = { cover_url: row.cover_url, updated_at: nowIso() };
    if (table === 'albums') payload.thumbnails = row.thumbnails ?? null;

    const { error } = await supabase
      .from(table)
      .update(payload)
      .eq('external_id', row.external_id)
      .is('cover_url', null);

    if (error) throw new Error(`[${table}_cover_fill] ${error.message}`);
  }
}

export async function upsertAlbums(inputs: AlbumInput[], artistId: string): Promise<{ map: IdMap; count: number }> {
  if (!artistId || !inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = inputs
    .map((a) => {
      const externalId = normalize(a.externalId);
      if (!externalId) return null;
      const rawType = a.albumType;
      const safeAlbumType = rawType === 'single' ? 'single' : rawType === 'ep' ? 'ep' : 'album';
      if (rawType !== safeAlbumType) {
        console.info('[phase2][album_type_defaulted]', {
          external_id: externalId,
          raw_type: rawType ?? null,
          applied: safeAlbumType,
        });
      }
      const coverUrl = bestCoverFromInput(a.coverUrl, a.thumbnails);
      return {
        external_id: externalId,
        artist_id: artistId,
        title: normalize(a.title) || externalId,
        album_type: safeAlbumType,
        cover_url: coverUrl,
        thumbnails: a.thumbnails ?? null,
        source: normalize(a.source) || DEFAULT_SOURCE,
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return { map: {}, count: 0 };

  const { error } = await supabase.from('albums').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[album_upsert] ${error.message}`);

  await fillMissingCovers('albums', rows.map((r) => ({ external_id: r.external_id, cover_url: r.cover_url ?? null, thumbnails: r.thumbnails })));

  const { data, error: selectError } = await supabase
    .from('albums')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[album_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    const { key, id } = mapExternalId(row);
    if (id && key) map[key] = id;
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
      const coverUrl = bestCoverFromInput(p.coverUrl, p.thumbnails);
      return {
        external_id: externalId,
        title: normalize(p.title) || externalId,
        description: normalize(p.description) || null,
        cover_url: coverUrl,
        playlist_type: p.playlistType ?? 'artist',
        source: normalize(p.source) || DEFAULT_SOURCE,
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return { map: {}, count: 0 };

  const { error } = await supabase.from('playlists').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[playlist_upsert] ${error.message}`);

  await fillMissingCovers('playlists', rows.map((r) => ({ external_id: r.external_id, cover_url: r.cover_url ?? null })));

  const { data, error: selectError } = await supabase
    .from('playlists')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[playlist_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    const { key, id } = mapExternalId(row);
    if (id && key) map[key] = id;
  });

  return { map, count: rows.length };
}

export async function upsertTracks(inputs: TrackInput[]): Promise<{ map: IdMap; idMap: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, idMap: {}, count: 0 };
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
        source: normalize(t.source) || DEFAULT_SOURCE,
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return { map: {}, idMap: {}, count: 0 };

  const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[track_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('tracks')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[track_upsert_select] ${selectError.message}`);

  const map: IdMap = {};
  (data || []).forEach((row: any) => {
    const { key, id } = mapExternalId(row);
    if (id && key) map[key] = id;
  });

  return { map, idMap: map, count: rows.length };
}

export async function seedArtistsFromNames(names: string[]): Promise<number> {
  if (!names.length) return 0;
  const now = nowIso();
  const seen = new Set<string>();
  const rows = names
    .map((raw) => normalize(raw))
    .filter(Boolean)
    .map((name) => {
      const key = canonicalArtistKeyFromName(name);
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        artist_key: key,
        name,
        display_name: name,
        source: 'seed',
        updated_at: now,
      };
    })
    .filter(Boolean) as Array<Record<string, any>>;

  if (!rows.length) return 0;

  const { data, error } = await supabase
    .from('artists')
    .upsert(rows, { onConflict: 'artist_key', ignoreDuplicates: true })
    .select('id');

  if (error) throw new Error(`[artist_seed] ${error.message}`);

  return (data || []).length;
}

export async function linkAlbumTracks(albumId: string, trackIds: string[]): Promise<number> {
  if (!albumId || !trackIds.length) return 0;
  const orderedIds = dedupePreserveOrder(trackIds);
  if (!orderedIds.length) return 0;
  const rows = orderedIds.map((trackId, index) => ({
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
  const orderedIds = dedupePreserveOrder(trackIds);
  if (!orderedIds.length) return 0;
  const rows = orderedIds.map((trackId, index) => ({
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
  const orderedIds = dedupePreserveOrder(trackIds);
  if (!orderedIds.length) return 0;
  const rows = orderedIds.map((trackId, index) => ({
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
  const orderedIds = dedupePreserveOrder(playlistIds);
  if (!orderedIds.length) return 0;
  const rows = orderedIds.map((playlistId) => ({
    artist_id: artistId,
    playlist_id: playlistId,
    role: 'primary',
    created_at: nowIso(),
  }));
  const { error } = await supabase.from('artist_playlists').upsert(rows, { onConflict: 'artist_id,playlist_id' });
  if (error) throw new Error(`[artist_playlists] ${error.message}`);
  return rows.length;
}
