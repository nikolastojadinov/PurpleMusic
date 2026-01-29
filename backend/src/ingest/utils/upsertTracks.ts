import supabase from '../../lib/supabase';
import { normalize, nowIso, type IdMap, type TrackInput } from '../utils';

const DEFAULT_SOURCE = 'ingest';

function buildRows(inputs: TrackInput[], timestamp: string): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  const seen = new Set<string>();

  inputs.forEach((track) => {
    const externalId = normalize(track.externalId);
    if (!externalId || seen.has(externalId)) return;
    seen.add(externalId);

    const row: Record<string, any> = {
      external_id: externalId,
      title: normalize(track.title) || externalId,
      duration_sec: track.durationSec ?? null,
      published_at: track.publishedAt ?? null,
      view_count: track.viewCount ?? null,
      like_count: track.likeCount ?? null,
      is_video: Boolean(track.isVideo),
      source: normalize(track.source) || DEFAULT_SOURCE,
      updated_at: timestamp,
    };

    const imageUrl = normalize(track.imageUrl ?? null);
    if (imageUrl) row.image_url = imageUrl;

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

export async function upsertTracks(inputs: TrackInput[]): Promise<{ map: IdMap; idMap: IdMap; count: number }> {
  if (!inputs.length) return { map: {}, idMap: {}, count: 0 };
  const now = nowIso();
  const rows = buildRows(inputs, now);

  if (!rows.length) return { map: {}, idMap: {}, count: 0 };

  const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[track_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('tracks')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[track_upsert_select] ${selectError.message}`);

  const map = mapExternalIds(data || []);
  return { map, idMap: map, count: rows.length };
}
