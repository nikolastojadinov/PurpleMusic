import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Loader2, Plus } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getSupabaseClient } from "../lib/supabaseClient";
import { usePlayer } from "../lib/playerContext";

type ArtistRecord = {
  id: string;
  name: string;
  display_name?: string | null;
  image_url?: string | null;
  description?: string | null;
  artist_key?: string | null;
  country?: string | null;
  subscriber_count?: number | null;
};

type TrackRecord = {
  id: string;
  title?: string | null;
  external_id?: string | null;
  duration_sec?: number | null;
  view_count?: number | null;
  image_url?: string | null;
  cover_url?: string | null;
  position?: number | null;
};

type AlbumRecord = {
  id: string;
  title: string;
  cover_url?: string | null;
  release_date?: string | null;
  album_type?: string | null;
};

type PlaylistRecord = {
  id: string;
  title: string;
  cover_url?: string | null;
  description?: string | null;
  playlist_type?: string | null;
};

const hasValidTitle = (title?: string | null) => Boolean(title && title.trim() && title.trim().toLowerCase() !== "untitled");

const isVideoId = (value?: string | null) => typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value.trim());

const buildDisplayTitle = (track: TrackRecord, fallbackMap: Record<string, string>) => {
  if (hasValidTitle(track.title)) return track.title!.trim();
  const externalId = track.external_id?.trim();
  if (externalId && fallbackMap[externalId]) return fallbackMap[externalId];
  if (externalId) return `Track ${externalId}`;
  return "Unknown track";
};

export default function ArtistPage() {
  const { artistId } = useParams();
  const { playTrack } = usePlayer();

  const [artist, setArtist] = useState<ArtistRecord | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [topTracks, setTopTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [titleFallbacks, setTitleFallbacks] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const artistName = useMemo(() => artist?.display_name || artist?.name || "Artist", [artist]);
  const heroImage = useMemo(() => artist?.image_url || "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1600&q=80", [artist]);
  const popularTracks = useMemo(() => (topTracks.length ? topTracks : tracks), [topTracks, tracks]);
  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    return [...topTracks, ...tracks].filter((t) => {
      const key = t.id || t.external_id || "";
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [topTracks, tracks]);

  useEffect(() => {
    if (!artistId) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const client = getSupabaseClient();

        const { data: artistData, error: artistErr } = await client
          .from("artists")
          .select("id,name,display_name,image_url,description,artist_key,country,subscriber_count")
          .eq("id", artistId)
          .single();

        if (artistErr) throw new Error(artistErr.message);
        if (!artistData) throw new Error("Artist not found");

        setArtist(artistData as ArtistRecord);
        const artistKey = artistData.artist_key || artistData.name;

        const [tracksRes, topTracksRes, albumsRes, playlistLinkRes] = await Promise.all([
          client
            .from("tracks")
            .select("id,title,external_id,duration_sec,view_count,image_url,cover_url")
            .eq("artist_key", artistKey)
            .order("view_count", { ascending: false })
            .limit(12),
          client
            .from("artist_tracks")
            .select("position, track:tracks(id,title,external_id,duration_sec,view_count,image_url,cover_url)")
            .eq("artist_key", artistKey)
            .eq("is_top_song", true)
            .order("position", { ascending: true })
            .limit(12),
          client
            .from("albums")
            .select("id,title,cover_url,release_date,album_type")
            .eq("artist_id", artistData.id)
            .order("release_date", { ascending: false })
            .limit(12),
          client.from("artist_playlists").select("playlist_id").eq("artist_id", artistData.id).limit(12),
        ]);

        if (tracksRes.error) throw new Error(tracksRes.error.message);
        if (topTracksRes.error) throw new Error(topTracksRes.error.message);
        if (albumsRes.error) throw new Error(albumsRes.error.message);
        if (playlistLinkRes.error) throw new Error(playlistLinkRes.error.message);

        setTracks((tracksRes.data as TrackRecord[]) || []);
        const mappedTop = (topTracksRes.data as any[])?.map((row) => ({ ...(row?.track || {}), position: row?.position }))?.filter((t) => t?.id);
        setTopTracks(mappedTop || []);
        setAlbums((albumsRes.data as AlbumRecord[]) || []);

        const playlistIds = (playlistLinkRes.data || []).map((p: any) => p.playlist_id).filter(Boolean);
        if (playlistIds.length) {
          const { data: playlistsData, error: playlistsErr } = await client
            .from("playlists")
            .select("id,title,cover_url,description,playlist_type")
            .in("id", playlistIds);
          if (playlistsErr) throw new Error(playlistsErr.message);
          setPlaylists((playlistsData as PlaylistRecord[]) || []);
        } else {
          setPlaylists([]);
        }
      } catch (err: any) {
        setError(err?.message || "Nije moguće učitati artista iz baze.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [artistId]);

  useEffect(() => {
    const missingIds = allTracks
      .map((t) => ({ id: t.external_id?.trim() || "", title: t.title }))
      .filter((t) => t.id && !hasValidTitle(t.title) && !titleFallbacks[t.id])
      .map((t) => t.id);

    const uniqueMissing = Array.from(new Set(missingIds)).slice(0, 6);
    if (!uniqueMissing.length) return;

    let cancelled = false;

    const fetchTitles = async () => {
      const entries = await Promise.all(
        uniqueMissing.map(async (externalId) => {
          try {
            const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${externalId}`);
            if (!res.ok) return null;
            const json = (await res.json()) as { title?: string };
            const candidate = json?.title?.trim();
            if (!candidate) return null;
            return [externalId, candidate] as const;
          } catch (err) {
            console.warn("[artist:title-fallback]", { externalId, message: (err as any)?.message || String(err) });
            return null;
          }
        })
      );

      if (cancelled) return;
      setTitleFallbacks((prev) => {
        const next = { ...prev };
        entries.forEach((entry) => {
          if (!entry) return;
          const [id, title] = entry;
          if (!next[id]) next[id] = title;
        });
        return next;
      });
    };

    void fetchTitles();

    return () => {
      cancelled = true;
    };
  }, [allTracks, titleFallbacks]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-white/70">
        <Loader2 className="h-5 w-5 animate-spin" />
        Učitavanje artista...
      </div>
    );
  }

  if (error || !artist) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
        {error || "Artist nije pronađen."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div
          className="relative h-[320px] w-full"
          style={{ backgroundImage: `linear-gradient(160deg, rgba(246,198,109,0.24), rgba(8,7,15,0.9)), url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute left-4 top-4 flex gap-2">
            <Link to="/search" className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-semibold text-white hover:border-white/25">
              <ArrowLeft className="mr-2 inline-block h-4 w-4" /> Back
            </Link>
          </div>

          <div className="absolute bottom-8 left-0 w-full px-4 md:px-6">
            <div className="space-y-3">
              <h1 className="text-3xl font-black leading-tight text-white drop-shadow md:text-4xl">{artistName}</h1>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium uppercase tracking-wide text-white/80">Artist</p>
                <button
                  className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-sm font-semibold text-white backdrop-blur hover:border-white/25"
                  type="button"
                >
                  <Heart className="mr-2 inline-block h-4 w-4" /> Follow
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-4 pb-6 pt-6 md:px-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white md:text-xl">Popular songs</h2>
            </div>
            {popularTracks.length ? (
              <div className="space-y-2">
                {popularTracks.map((song, index) => {
                  const cover = song.cover_url || song.image_url || heroImage;
                  const title = buildDisplayTitle(song, titleFallbacks);
                  const youtubeVideoId = song.external_id?.trim() || "";
                  const playable = isVideoId(youtubeVideoId);
                  return (
                    <div
                      key={song.id || `${title}-${index}`}
                      className="flex items-center gap-3 px-1 py-2"
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (!playable) return;
                        playTrack({
                          youtubeVideoId,
                          title,
                          artist: artistName,
                          thumbnailUrl: cover,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (!playable) return;
                          playTrack({
                            youtubeVideoId,
                            title,
                            artist: artistName,
                            thumbnailUrl: cover,
                          });
                        }
                      }}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                        <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-white">{title}</div>
                        <div className="text-xs text-white/60">{artistName}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur hover:border-white/25"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Heart className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-white/80 backdrop-blur hover:border-white/25"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Nema pesama za ovog artista.</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white md:text-xl">Albums</h2>
            {albums.length ? (
              <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:'none'] [&::-webkit-scrollbar]:hidden">
                {albums.map((album) => (
                  <div key={album.id} className="w-40 flex-shrink-0">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                      <img src={album.cover_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="mt-2">
                      <div className="truncate text-sm font-semibold text-white">{album.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Nema albuma.</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white md:text-xl">Playlists</h2>
            {playlists.length ? (
              <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:'none'] [&::-webkit-scrollbar]:hidden">
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="w-40 flex-shrink-0">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                      <img src={playlist.cover_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="mt-2">
                      <div className="truncate text-sm font-semibold text-white">{playlist.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Nema plejlista.</div>
            )}
          </section>

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h2 className="text-lg font-semibold text-white md:text-xl">About</h2>
            <div className="space-y-2 text-sm leading-relaxed text-white/80">
              {artist.description ? artist.description : ""}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
