import pLimit from 'p-limit';
import { browsePlaylistById } from '../../ytmusic/innertubeClient';
import {
  linkAlbumTracks,
  linkArtistTracks,
  linkPlaylistTracks,
  normalize,
  toSeconds,
  upsertAlbums,
  upsertPlaylists,
  upsertTracks,
  type AlbumInput,
  type PlaylistInput,
  type TrackInput,
} from '../utils';

export type Phase3Input = {
  artistId: string;
  artistKey: string;
  albums: AlbumInput[];
  playlists: PlaylistInput[];
  topSongs: TrackInput[];
};

export type Phase3Output = {
  trackCount: number;
  albumsProcessed: number;
  playlistsProcessed: number;
};

type IdMap = Record<string, string>;

const CONCURRENCY = 3;

function buildTrackInputs(tracks: Array<{ videoId: string; title: string; duration?: string | number | null; thumbnail?: string | null; artist?: string | null }>, source: 'album' | 'playlist'): TrackInput[] {
  return (tracks || []).map((t) => ({
    externalId: normalize(t.videoId),
    title: normalize(t.title) || 'Untitled',
    durationSec: toSeconds((t as any)?.duration),
    imageUrl: (t as any)?.thumbnail ?? null,
    isVideo: true,
    source,
  }));
}

function orderedTrackIds(tracks: Array<{ videoId: string }>, idMap: IdMap): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  (tracks || []).forEach((track) => {
    const vid = normalize(track.videoId);
    if (!vid) return;
    const id = idMap[vid];
    if (!id || seen.has(id)) return;
    seen.add(id);
    ordered.push(id);
  });
  return ordered;
}

async function upsertAlbumsAndPlaylists(albums: AlbumInput[], playlists: PlaylistInput[], artistId: string): Promise<{ albumIdMap: IdMap; playlistIdMap: IdMap }> {
  const [{ map: albumIdMap }, { map: playlistIdMap }] = await Promise.all([
    upsertAlbums(albums, artistId),
    upsertPlaylists(playlists),
  ]);
  return { albumIdMap, playlistIdMap };
}

async function ingestAlbum(artistId: string, album: AlbumInput, albumIdMap: IdMap): Promise<number> {
  const browse = await browsePlaylistById(album.externalId);
  if (!browse || !Array.isArray(browse.tracks) || !browse.tracks.length) return 0;

  const trackInputs = buildTrackInputs(browse.tracks, 'album');
  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(browse.tracks, map);

  const albumId = albumIdMap[normalize(album.externalId)] || albumIdMap[normalize((browse as any)?.browseId)];
  if (albumId && ordered.length) await linkAlbumTracks(albumId, ordered);
  if (ordered.length) await linkArtistTracks(artistId, ordered);

  return ordered.length;
}

async function ingestPlaylist(artistId: string, playlist: PlaylistInput, playlistIdMap: IdMap): Promise<{ trackCount: number; trackIds: string[] }> {
  const browse = await browsePlaylistById(playlist.externalId);
  if (!browse || !Array.isArray(browse.tracks) || !browse.tracks.length) return { trackCount: 0, trackIds: [] };

  const trackInputs = buildTrackInputs(browse.tracks, 'playlist');
  const { map } = await upsertTracks(trackInputs);
  const ordered = orderedTrackIds(browse.tracks, map);

  const playlistId = playlistIdMap[normalize(playlist.externalId)] || playlistIdMap[normalize((browse as any)?.browseId)];
  if (playlistId && ordered.length) await linkPlaylistTracks(playlistId, ordered);

  return { trackCount: ordered.length, trackIds: ordered };
}

export async function runPhase3Expansion(params: Phase3Input): Promise<Phase3Output> {
  const limiter = pLimit(CONCURRENCY);

  const { albumIdMap, playlistIdMap } = await upsertAlbumsAndPlaylists(params.albums, params.playlists, params.artistId);

  const albumTasks = params.albums.map((album) => limiter(() => ingestAlbum(params.artistId, album, albumIdMap)));
  const playlistTasks = params.playlists.map((playlist) => limiter(() => ingestPlaylist(params.artistId, playlist, playlistIdMap)));

  const albumResults = await Promise.allSettled(albumTasks);
  const playlistResults = await Promise.allSettled(playlistTasks);

  let trackCount = 0;
  albumResults.forEach((result) => {
    if (result.status === 'fulfilled') trackCount += result.value;
  });

  const playlistTrackIds: string[] = [];
  playlistResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      trackCount += result.value.trackCount;
      playlistTrackIds.push(...result.value.trackIds);
    }
  });

  if (params.topSongs?.length) {
    const { map } = await upsertTracks(params.topSongs);
    const ids = Object.values(map);
    if (ids.length) await linkArtistTracks(params.artistId, ids);
    trackCount += ids.length;
  }

  const combinedArtistTrackIds = Array.from(new Set<string>(playlistTrackIds));
  if (combinedArtistTrackIds.length) {
    await linkArtistTracks(params.artistId, combinedArtistTrackIds);
  }

  console.info('[phase3] expansion_complete', {
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
    totalTracksInserted: trackCount,
  });

  return {
    trackCount,
    albumsProcessed: params.albums.length,
    playlistsProcessed: params.playlists.length,
  };
}

