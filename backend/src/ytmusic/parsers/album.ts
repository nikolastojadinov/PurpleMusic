import type { AlbumBrowse } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function normalizeAlbumBrowse(browse: AlbumBrowse | null): AlbumBrowse | null {
  if (!browse) return null;
  return {
    ...browse,
    browseId: normalize(browse.browseId),
    title: normalize(browse.title) || 'Album',
    thumbnail: browse.thumbnail ?? null,
  };
}
