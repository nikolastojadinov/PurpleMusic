import supabase from '../../lib/supabase';
import { normalize, nowIso } from '../utils';

function dedupe(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  ids.forEach((id) => {
    const normalized = normalize(id);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(normalized);
  });
  return out;
}

export async function linkArtistAlbums(artistKey: string, albumIds: string[]): Promise<number> {
  const key = normalize(artistKey);
  const ordered = dedupe(albumIds);
  if (!key || !ordered.length) return 0;

  const rows = ordered.map((albumId) => ({
    artist_key: key,
    album_id: albumId,
    created_at: nowIso(),
  }));

  const { error, data } = await supabase
    .from('artist_albums')
    .upsert(rows, { onConflict: 'artist_key,album_id', ignoreDuplicates: true })
    .select('album_id');

  if (error) throw new Error(`[artist_albums_link] ${error.message}`);

  return data ? data.length : 0;
}
