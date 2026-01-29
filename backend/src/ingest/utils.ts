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

export function dedupePreserveOrder(ids: string[]): string[] {
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

