import supabase from '../../lib/supabase';
import { normalize, nowIso, type AlbumInput, type IdMap } from '../utils';

const DEFAULT_SOURCE = 'ingest';

function canonicalAlbumType(raw: AlbumInput['albumType']): 'album' | 'single' | 'ep' {
  if (raw === 'single') return 'single';
  if (raw === 'ep') return 'ep';
  return 'album';
}

function buildRows(inputs: AlbumInput[], artistId: string, timestamp: string): Array<Record<string, any>> {
  const rows: Array<Record<string, any>> = [];
  const seen = new Set<string>();

  inputs.forEach((album) => {
    const externalId = normalize(album.externalId);
    if (!externalId || seen.has(externalId)) return;
    seen.add(externalId);

    const row: Record<string, any> = {
      external_id: externalId,
      artist_id: artistId,
      title: normalize(album.title) || externalId,
      album_type: canonicalAlbumType(album.albumType),
      source: normalize(album.source) || DEFAULT_SOURCE,
      updated_at: timestamp,
    };

    const coverUrl = normalize(album.coverUrl ?? null);
    if (coverUrl) row.cover_url = coverUrl;

    if (album.thumbnails !== undefined) row.thumbnails = album.thumbnails ?? null;

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

export async function upsertAlbums(inputs: AlbumInput[], artistId: string): Promise<{ map: IdMap; count: number }> {
  if (!artistId || !inputs.length) return { map: {}, count: 0 };
  const now = nowIso();
  const rows = buildRows(inputs, artistId, now);

  if (!rows.length) return { map: {}, count: 0 };

  const { error } = await supabase.from('albums').upsert(rows, { onConflict: 'external_id' });
  if (error) throw new Error(`[album_upsert] ${error.message}`);

  const { data, error: selectError } = await supabase
    .from('albums')
    .select('id, external_id')
    .in('external_id', rows.map((r) => r.external_id));
  if (selectError) throw new Error(`[album_upsert_select] ${selectError.message}`);

  return { map: mapExternalIds(data || []), count: rows.length };
}
