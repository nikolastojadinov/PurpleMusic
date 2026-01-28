import { canonicalArtistKey, normalize, nowIso, upsertArtist } from '../utils';
import { fetchArtistBrowse, resolveArtistBrowseIdByName, type ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase1Output = {
  artistKey: string;
  artistId: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
};

export async function runPhase1Core(params: {
  browseId?: string;
  artistName?: string;
  requestedArtistKey?: string;
  youtubeChannelId?: string;
}): Promise<Phase1Output> {
  const started = Date.now();
  const providedChannelId = normalize(params.youtubeChannelId);
  const initialBrowseId = normalize(params.browseId || providedChannelId);
  const artistName = normalize(params.artistName);

  if (!initialBrowseId && !artistName) throw new Error('browseId or artistName is required for phase1');

  const looksOfficialArtistId = (value: string) => /^(UC|MPLA)/i.test(value);

  let browseId = initialBrowseId;
  if (browseId && !looksOfficialArtistId(browseId) && artistName) {
    const resolved = await resolveArtistBrowseIdByName(artistName);
    if (resolved) browseId = resolved;
    console.info('[phase1_core] browse_id_normalized', { name: artistName, input: initialBrowseId, browseId: resolved });
  }

  if (!browseId && artistName) {
    const resolved = await resolveArtistBrowseIdByName(artistName);
    browseId = resolved || '';
    console.info('[phase1_core] resolved_browse_id', { name: artistName, browseId: resolved });
  }

  if (!looksOfficialArtistId(browseId)) {
    throw new Error('browseId must be an official channel or artist id');
  }

  if (!browseId) throw new Error('browseId resolution failed for phase1');

  console.info('[ingest][phase1_core] phase_start', { browseId, at: nowIso() });

  const artistBrowse = await fetchArtistBrowse(browseId);
  if (!artistBrowse) throw new Error('artist browse failed');

  const artistKey = canonicalArtistKey(params.requestedArtistKey || artistBrowse.name, artistBrowse.channelId);

  const artistResult = await upsertArtist({
    artistKey,
    name: artistBrowse.name,
    displayName: artistBrowse.name,
    youtubeChannelId: artistBrowse.channelId,
    description: artistBrowse.description,
    thumbnails: artistBrowse.thumbnails,
    source: 'ingest',
  });

  const duration = Date.now() - started;
  console.info('[ingest][phase1_core] phase_complete', { artist_key: artistKey, browse_id: browseId, duration_ms: duration });

  return { artistKey: artistResult.artistKey, artistId: artistResult.id, browseId, artistBrowse };
}
