import type { PlaylistBrowse } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function normalizePlaylistBrowse(browse: PlaylistBrowse | null): PlaylistBrowse | null {
  if (!browse) return null;
  const thumbnails = Array.isArray(browse.thumbnails) ? browse.thumbnails : [];
  const thumbnail = browse.thumbnail ?? thumbnails.at(-1)?.url ?? null;

  return {
    ...browse,
    browseId: normalize(browse.browseId),
    title: normalize(browse.title) || 'Playlist',
    subtitle: normalize(browse.subtitle) || null,
    thumbnail,
    thumbnails,
  };
}
