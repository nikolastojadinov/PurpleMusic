import { normalize, toSeconds, upsertAlbums, upsertPlaylists, type AlbumInput, type PlaylistInput, type TrackInput, type IdMap } from '../utils';
import type { ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase2Output = {
  artistId: string;
  artistKey: string;
  browseId: string;
  albums: AlbumInput[];
  playlists: PlaylistInput[];
  topSongs: TrackInput[];
  albumIdMap: IdMap;
  playlistIdMap: IdMap;
};

type RawAlbum = ArtistBrowse['albums'][number];
type RawPlaylist = ArtistBrowse['playlists'][number];
type RawTopSong = ArtistBrowse['topSongs'][number];

function pickAlbumType(trackCount: number | null | undefined): 'album' | 'single' | 'ep' | null {
  if (!Number.isFinite(trackCount)) return null;
  const count = Number(trackCount);
  if (count <= 3) return 'single';
  if (count <= 6) return 'ep';
  return 'album';
}

function pickCoverUrl(candidate?: string | null, thumbnailUrl?: string | null, thumbnails?: Array<{ url?: string }>): string | null {
  const first = normalize(candidate);
  if (first) return first;
  const second = normalize(thumbnailUrl);
  if (second) return second;
  if (Array.isArray(thumbnails)) {
    for (const thumb of thumbnails) {
      const url = normalize((thumb as any)?.url);
      if (url) return url;
    }
  }
  return null;
}

function dedupeByExternalId<T extends { externalId: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  items.forEach((item) => {
    const key = normalize(item.externalId);
    if (!key || seen.has(key)) return;
    seen.add(key);
    result.push({ ...item, externalId: key });
  });
  return result;
}

function mapAlbums(raw: RawAlbum[]): AlbumInput[] {
  return dedupeByExternalId(
    (raw || []).map((album) => ({
      externalId: album.id,
      title: album.title,
      albumType: pickAlbumType(album.trackCount ?? null),
      coverUrl: pickCoverUrl((album as any)?.imageUrl, album.thumbnail, (album as any)?.thumbnails),
      thumbnails: (album as any)?.thumbnails ?? null,
      source: 'artist_browse',
    })),
  );
}

function mapPlaylists(raw: RawPlaylist[]): PlaylistInput[] {
  return dedupeByExternalId(
    (raw || []).map((playlist) => ({
      externalId: playlist.id,
      title: playlist.title,
      coverUrl: pickCoverUrl((playlist as any)?.imageUrl, playlist.thumbnail, (playlist as any)?.thumbnails),
      thumbnails: (playlist as any)?.thumbnails ?? null,
      playlistType: 'artist',
      source: 'artist_browse',
    })),
  );
}

function mapTopSongs(raw: RawTopSong[]): TrackInput[] {
  return dedupeByExternalId(
    (raw || []).map((song) => ({
      externalId: song.videoId,
      title: song.title,
      durationSec: toSeconds(song.duration),
      imageUrl: pickCoverUrl((song as any)?.imageUrl, song.thumbnail, (song as any)?.thumbnails),
      isVideo: true,
      source: 'artist_top_song',
    })),
  );
}

export async function runPhase2Metadata(params: {
  artistId: string;
  artistKey: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
}): Promise<Phase2Output> {
  const albums = mapAlbums(params.artistBrowse.albums || []);
  const playlists = mapPlaylists(params.artistBrowse.playlists || []);
  const topSongs = mapTopSongs(params.artistBrowse.topSongs || []);

  const { map: albumIdMap } = await upsertAlbums(albums, params.artistId);
  const { map: playlistIdMap } = await upsertPlaylists(playlists);

  console.info('[phase2] extracted', {
    albums: albums.length,
    playlists: playlists.length,
    topSongs: topSongs.length,
  });

  return {
    artistId: params.artistId,
    artistKey: params.artistKey,
    browseId: params.browseId,
    albums,
    playlists,
    topSongs,
    albumIdMap,
    playlistIdMap,
  };
}

