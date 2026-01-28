import type { PlaylistBrowse } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function normalizePlaylistBrowse(browse: PlaylistBrowse | null): PlaylistBrowse | null {
  if (!browse) return null;
  return {
    ...browse,
    browseId: normalize(browse.browseId),
    title: normalize(browse.title) || 'Playlist',
    subtitle: normalize(browse.subtitle) || null,
    thumbnail: browse.thumbnail ?? null,
  };
}
