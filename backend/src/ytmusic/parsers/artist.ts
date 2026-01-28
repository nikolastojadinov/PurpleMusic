import type { ArtistBrowse, YTMusicTrack } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function mapArtistTracks(tracks: YTMusicTrack[]): YTMusicTrack[] {
  return Array.isArray(tracks)
    ? tracks
        .map((t) => ({
          videoId: normalize(t.videoId),
          title: normalize(t.title) || 'Untitled',
          artist: normalize(t.artist) || 'Unknown artist',
          duration: t.duration ?? null,
          thumbnail: t.thumbnail ?? null,
        }))
        .filter((t) => t.videoId)
    : [];
}

export function summarizeArtistBrowse(browse: ArtistBrowse | null): {
  albumCount: number;
  playlistCount: number;
  topSongCount: number;
} {
  if (!browse) return { albumCount: 0, playlistCount: 0, topSongCount: 0 };
  return {
    albumCount: Array.isArray(browse.albums) ? browse.albums.length : 0,
    playlistCount: Array.isArray(browse.playlists) ? browse.playlists.length : 0,
    topSongCount: Array.isArray(browse.topSongs) ? browse.topSongs.length : 0,
  };
}
