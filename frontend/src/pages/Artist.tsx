import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Heart, Loader2, Play, Shuffle, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getSupabaseClient } from "../lib/supabaseClient";

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
  title: string;
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

const formatDuration = (seconds?: number | null) => {
  if (!seconds || seconds <= 0) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function ArtistPage() {
  const { artistId } = useParams();

  const [artist, setArtist] = useState<ArtistRecord | null>(null);
  const [tracks, setTracks] = useState<TrackRecord[]>([]);
  const [topTracks, setTopTracks] = useState<TrackRecord[]>([]);
  const [albums, setAlbums] = useState<AlbumRecord[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const artistName = useMemo(() => artist?.display_name || artist?.name || "Artist", [artist]);
  const heroImage = useMemo(() => artist?.image_url || "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1600&q=80", [artist]);
  const topSong = useMemo(() => (topTracks.length ? topTracks[0] : tracks[0]), [topTracks, tracks]);
  const popularTracks = useMemo(() => (topTracks.length ? topTracks : tracks), [topTracks, tracks]);

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
            .select("id,title,duration_sec,view_count,image_url,cover_url")
            .eq("artist_key", artistKey)
            .order("view_count", { ascending: false })
            .limit(12),
          client
            .from("artist_tracks")
            .select("position, track:tracks(id,title,duration_sec,view_count,image_url,cover_url)")
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
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-4 w-4 text-[#F6C66D]" /> From Supabase
            </span>
          </div>

          <div className="absolute bottom-8 left-0 w-full px-4 md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl font-black leading-tight text-white drop-shadow md:text-4xl">{artistName}</h1>
                <p className="text-sm font-medium uppercase tracking-wide text-white/80">Artist</p>
              </div>
              {/* description intentionally hidden */}
            </div>
          </div>
        </div>

        <div className="space-y-8 px-4 pb-6 pt-6 md:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <button className="pm-cta-pill" type="button">
              <span className="pm-cta-pill-inner">
                <Play className="h-4 w-4" /> Play preview
              </span>
            </button>
            <button className="pm-cta-pill pm-cta-pill--subtle" type="button">
              <span className="pm-cta-pill-inner">
                <Shuffle className="h-4 w-4" /> Shuffle
              </span>
            </button>
            <button className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white hover:border-white/25" type="button">
              <Heart className="mr-2 inline-block h-4 w-4" /> Follow
            </button>
          </div>

          {topSong ? (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-white md:text-xl">Top song</h2>
                  <p className="text-xs text-white/60">Najslušanija pesma iz baze</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">{formatDuration(topSong.duration_sec)}</span>
              </div>
              <div className="flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                  <img src={topSong.cover_url || topSong.image_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="truncate text-base font-semibold text-white">{topSong.title}</div>
                  <div className="text-xs text-white/60">{artistName}</div>
                  {typeof topSong.view_count === "number" ? <div className="text-xs text-white/60">{topSong.view_count.toLocaleString()} pregleda</div> : null}
                </div>
                <button className="pm-cta-pill" type="button">
                  <span className="pm-cta-pill-inner">
                    <Play className="h-4 w-4" /> Play
                  </span>
                </button>
              </div>
            </section>
          ) : null}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white md:text-xl">Popular songs</h2>
              <span className="text-xs text-white/60">Iz baze</span>
            </div>
            {popularTracks.length ? (
              <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {popularTracks.map((song, index) => (
                  <div key={song.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                      <img src={song.cover_url || song.image_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-white">{song.title}</div>
                      <div className="text-xs text-white/60">{artistName}</div>
                    </div>
                    <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">
                      {formatDuration(song.duration_sec)} · #{(song.position ?? index) + 1}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">Nema pesama za ovog artista.</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white md:text-xl">Albums</h2>
            {albums.length ? (
              <div className="flex gap-4 overflow-x-auto pb-1">
                {albums.map((album) => (
                  <div key={album.id} className="w-40 flex-shrink-0">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                      <img src={album.cover_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="truncate text-sm font-semibold text-white">{album.title}</div>
                      <div className="text-xs text-white/60">{album.release_date?.slice(0, 4) || album.album_type || "Album"}</div>
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
              <div className="flex gap-4 overflow-x-auto pb-1">
                {playlists.map((playlist) => (
                  <div key={playlist.id} className="w-40 flex-shrink-0">
                    <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                      <img src={playlist.cover_url || heroImage} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="truncate text-sm font-semibold text-white">{playlist.title}</div>
                      <div className="text-xs text-white/60">{playlist.playlist_type || playlist.description || "Playlist"}</div>
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
