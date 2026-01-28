import supabase from '../../lib/supabase';
import { normalize, nowIso } from '../utils';
import { fetchArtistBrowse, resolveArtistBrowseIdByName, type ArtistBrowse } from '../../ytmusic/innertubeClient';

export type Phase1Output = {
  artistKey: string;
  artistId: string;
  browseId: string;
  artistBrowse: ArtistBrowse;
};

type Phase1Params = {
  requestedArtistKey: string;
  youtubeChannelId?: string | null;
  browseId?: string | null;
  artistName?: string | null;
};

const looksOfficialArtistId = (value: string | null | undefined): value is string => {
  const v = normalize(value).toUpperCase();
  return /^UC/.test(v) || /^MPLA/.test(v);
};

async function loadExistingArtist(artistKeyRaw: string) {
  const artistKey = normalize(artistKeyRaw);
  if (!artistKey) throw new Error('requestedArtistKey is required');

  const { data, error } = await supabase
    .from('artists')
    .select('id, artist_key, name, display_name, youtube_channel_id, description, thumbnails')
    .eq('artist_key', artistKey)
    .maybeSingle();

  if (error) throw new Error(`[phase1_core] failed to load artist: ${error.message}`);
  if (!data) throw new Error(`[phase1_core] artist not found: ${artistKey}`);

  return data;
}

async function resolveBrowseId(params: {
  existingChannelId?: string | null;
  incomingBrowseId?: string | null;
  incomingChannelId?: string | null;
  searchName?: string | null;
}): Promise<string> {
  const direct = normalize(params.incomingBrowseId || params.incomingChannelId || params.existingChannelId);
  if (looksOfficialArtistId(direct)) return direct;

  const name = normalize(params.searchName);
  if (!name) throw new Error('[phase1_core] cannot resolve browseId without a name');

  const resolved = await resolveArtistBrowseIdByName(name);
  if (!looksOfficialArtistId(resolved)) {
    throw new Error('[phase1_core] failed to resolve official artist browseId');
  }
  return normalize(resolved);
}

async function updateArtistChannelAndMeta(artistKey: string, browseId: string, browse: ArtistBrowse, existing: any): Promise<void> {
  const updatePayload: Record<string, any> = {
    youtube_channel_id: browseId,
    updated_at: nowIso(),
  };

  if (browse.description) updatePayload.description = browse.description;
  if (browse.thumbnails && browse.thumbnails.length > 0) updatePayload.thumbnails = browse.thumbnails;
  const displayName = normalize(existing.display_name || existing.name);
  if (!displayName && browse.name) {
    updatePayload.display_name = browse.name;
  }
  if (!normalize(existing.name) && browse.name) {
    updatePayload.name = browse.name;
  }

  const { error } = await supabase.from('artists').update(updatePayload).eq('artist_key', artistKey);
  if (error) throw new Error(`[phase1_core] failed to update artist: ${error.message}`);
}

export async function runPhase1Core(params: Phase1Params): Promise<Phase1Output> {
  const started = Date.now();
  const requestedArtistKey = normalize(params.requestedArtistKey);
  const existing = await loadExistingArtist(requestedArtistKey);

  const browseId = await resolveBrowseId({
    existingChannelId: existing.youtube_channel_id,
    incomingBrowseId: params.browseId,
    incomingChannelId: params.youtubeChannelId,
    searchName: params.artistName || existing.name || existing.display_name,
  });

  console.info('[ingest][phase1_core] phase_start', { artist_key: requestedArtistKey, browse_id: browseId, at: nowIso() });

  const artistBrowse = await fetchArtistBrowse(browseId);
  if (!artistBrowse) throw new Error('artist browse failed');

  await updateArtistChannelAndMeta(requestedArtistKey, browseId, artistBrowse, existing);

  const duration = Date.now() - started;
  console.info('[ingest][phase1_core] phase_complete', {
    artist_key: requestedArtistKey,
    browse_id: browseId,
    duration_ms: duration,
  });

  return {
    artistKey: requestedArtistKey,
    artistId: existing.id,
    browseId,
    artistBrowse,
  };
}
