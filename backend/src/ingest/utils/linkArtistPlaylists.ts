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

export async function linkArtistPlaylists(artistId: string, playlistIds: string[]): Promise<number> {
  const artist = normalize(artistId);
  const ordered = dedupe(playlistIds);
  if (!artist || !ordered.length) return 0;

  const rows = ordered.map((playlistId) => ({
    artist_id: artist,
    playlist_id: playlistId,
    role: 'owner',
    created_at: nowIso(),
  }));

  const { error, data } = await supabase
    .from('artist_playlists')
    .upsert(rows, { onConflict: 'artist_id,playlist_id', ignoreDuplicates: true })
    .select('playlist_id');

  if (error) throw new Error(`[artist_playlists_link] ${error.message}`);

  return data ? data.length : 0;
}
