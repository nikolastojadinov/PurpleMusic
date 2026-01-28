import { canonicalArtistKey, normalize, nowIso, upsertArtist } from '../utils';
import { fetchArtistBrowse, type ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase1Output = {
  artistKey: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
};

export async function runPhase1Core(params: { browseId: string; requestedArtistKey?: string }): Promise<Phase1Output> {
  const started = Date.now();
  const browseId = normalize(params.browseId);
  if (!browseId) throw new Error('browseId is required for phase1');

  console.info('[ingest][phase1_core] phase_start', { browseId, at: nowIso() });

  const artistBrowse = await fetchArtistBrowse(browseId);
  if (!artistBrowse) throw new Error('artist browse failed');

  const artistKey = canonicalArtistKey(params.requestedArtistKey || artistBrowse.name, artistBrowse.channelId);

  await upsertArtist({
    artist_key: artistKey,
    display_name: artistBrowse.name,
    artist: artistBrowse.name,
    youtube_channel_id: artistBrowse.channelId,
    artist_description: artistBrowse.description,
    thumbnails: artistBrowse.thumbnails,
  });

  const duration = Date.now() - started;
  console.info('[ingest][phase1_core] phase_complete', { artist_key: artistKey, browse_id: browseId, duration_ms: duration });

  return { artistKey, browseId, artistBrowse };
}
