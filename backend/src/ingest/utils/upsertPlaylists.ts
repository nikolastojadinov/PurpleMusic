import supabase from '../../lib/supabase';
import { normalize, nowIso, type IdMap, type PlaylistInput } from '../utils';

const DEFAULT_SOURCE = 'ingest';

function buildRows(inputs: PlaylistInput[], timestamp: string): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  const seen = new Set<string>();

  inputs.forEach((playlist) => {
    const externalId = normalize(playlist.externalId);
    if (!externalId || seen.has(externalId)) return;
    seen.add(externalId);

    const row: Record<string, any> = {
      external_id: externalId,
      title: normalize(playlist.title) || externalId,
      description: normalize(playlist.description) || null,
      playlist_type: playlist.playlistType ?? 'artist',
      source: normalize(playlist.source) || DEFAULT_SOURCE,
      updated_at: timestamp,
    };

    const coverUrl = normalize(playlist.coverUrl ?? null);
    if (coverUrl) row.cover_url = coverUrl;

    return rows.push(row);
  });

  return rows;
}

function mapExternalIds(rows: Array<{ external_id: string; id?: string | null }>): IdMap {
  const map: IdMap = {};
  rows.forEach((row) => {
    const key = normalize(row.external_id);
    const id = row?.id ? String(row.id) : null;
    if (key && id) map[key] = id;
  });
  return map;
}

export async function upsertPlaylists(inputs: PlaylistInput[]): Promise<{ map: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = buildRows(inputs, now);

  if (!rows.length) return { map: {}, count: 0 };

  console.info('[debug][upsertPlaylists] rows_sample', rows.slice(0, 3).map((r) => ({
    external_id: r.external_id,
    cover_url: r.cover_url ?? null,
    title: r.title,
  })));

  const { error } = await supabase.from('playlists').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[playlist_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('playlists')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[playlist_upsert_select] ${selectError.message}`);

  return { map: mapExternalIds(data || []), count: rows.length };
}
