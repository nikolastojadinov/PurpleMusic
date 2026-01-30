// PORTED FROM legacy hajde-music-stream:
// file: https://raw.githubusercontent.com/nikolastojadinov/hajde-music-stream/main/backend/src/services/fullArtistIngest.ts
// function(s): runFullArtistIngest
import { ingestArtist, type IngestArtistParams, type IngestArtistResult } from '../services/ingestArtist';

export type IngestOneArtistParams = IngestArtistParams;

export type IngestOneArtistResult = IngestArtistResult;

export async function ingestOneArtist(params: IngestOneArtistParams): Promise<IngestOneArtistResult> {
  return ingestArtist(params);
}
