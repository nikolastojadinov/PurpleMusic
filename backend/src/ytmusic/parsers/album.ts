import type { AlbumBrowse } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function normalizeAlbumBrowse(browse: AlbumBrowse | null): AlbumBrowse | null {
  if (!browse) return null;
  const thumbnails = Array.isArray(browse.thumbnails) ? browse.thumbnails : [];
  const thumbnail = browse.thumbnail ?? thumbnails.at(-1)?.url ?? null;

  return {
    ...browse,
    browseId: normalize(browse.browseId),
    title: normalize(browse.title) || 'Album',
    thumbnail,
    thumbnails,
  };
}
