import type { ArtistBrowse, YTMusicTrack } from '../innertubeClient';
import { normalize } from '../../ingest/utils';

export function mapArtistTracks(tracks: YTMusicTrack[]): YTMusicTrack[] {
  return Array.isArray(tracks)
    ? tracks
        .map((t) => {
          const thumbnails = Array.isArray(t.thumbnails) ? t.thumbnails : [];
          const thumbnail = t.thumbnail ?? thumbnails.at(-1)?.url ?? null;
          const artists = Array.isArray(t.artists)
            ? t.artists.map((a) => normalize(a)).filter(Boolean)
            : [];
          const artist = normalize(t.artist) || artists[0] || 'Unknown artist';

          return {
            videoId: normalize(t.videoId),
            title: normalize(t.title) || 'Untitled',
            artist,
            artists: artists.length ? artists : [artist],
            duration: t.duration ?? null,
            thumbnail,
            thumbnails,
          } satisfies YTMusicTrack;
        })
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
