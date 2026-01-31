import { useMemo } from "react";
import { ArrowLeft, Heart, Play, Shuffle, Sparkles } from "lucide-react";
import { Link, useParams } from "react-router-dom";

const songs = [
  { title: "Velvet Skyline", duration: "3:22", image: "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=600&q=80" },
  { title: "Glass Atlas", duration: "2:58", image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=600&q=80" },
  { title: "Neon Letters", duration: "3:47", image: "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=600&q=80" },
  { title: "Polaroid Bloom", duration: "4:02", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80" },
];

const albums = [
  { title: "Analog Bloom", year: "2024", image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=600&q=80" },
  { title: "Future Nostalgia", year: "2023", image: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=600&q=80" },
  { title: "Indie Sunlight", year: "2022", image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=600&q=80" },
];

const playlists = [
  { title: "Crush // Covers", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80" },
  { title: "Bass Therapy", image: "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=600&q=80" },
];

const aboutLines = [
  "Hajde-inspired hero with layered gradients and soft glow.",
  "This page is static—wire your own data sources when ready.",
  "Design matched to hajde-music-stream for visual parity.",
];

export default function ArtistPage() {
  const { artistId } = useParams();
  const artistName = useMemo(() => artistId?.toString() || "Serene Echoes", [artistId]);

  const heroImage = "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1600&q=80";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div
          className="relative h-[320px] w-full"
          style={{ backgroundImage: `linear-gradient(160deg, rgba(246,198,109,0.24), rgba(8,7,15,0.9)), url(${heroImage})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute left-4 top-4 flex gap-2">
            <Link to="/" className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-sm font-semibold text-white hover:border-white/25">
              <ArrowLeft className="mr-2 inline-block h-4 w-4" /> Back
            </Link>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
              <Sparkles className="h-4 w-4 text-[#F6C66D]" /> Visual placeholder
            </span>
          </div>

          <div className="absolute bottom-8 left-0 w-full px-4 md:px-6">
            <div className="flex items-end gap-4">
              <div className="h-20 w-20 overflow-hidden rounded-full border border-white/15 bg-neutral-900 shadow-lg md:h-24 md:w-24">
                <img src={heroImage} alt={artistName} className="h-full w-full object-cover" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl font-black leading-tight text-white drop-shadow md:text-4xl">{artistName}</h1>
                <p className="text-sm font-medium uppercase tracking-wide text-white/80">Artist</p>
              </div>
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

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white md:text-xl">Popular songs</h2>
              <span className="text-xs text-white/60">Static list</span>
            </div>
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              {songs.map((song, index) => (
                <div key={song.title} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                    <img src={song.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{song.title}</div>
                    <div className="text-xs text-white/60">{artistName}</div>
                  </div>
                  <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{song.duration} · #{index + 1}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white md:text-xl">Albums</h2>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {albums.map((album) => (
                <div key={album.title} className="w-40 flex-shrink-0">
                  <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                    <img src={album.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="truncate text-sm font-semibold text-white">{album.title}</div>
                    <div className="text-xs text-white/60">{album.year}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white md:text-xl">Playlists</h2>
            <div className="flex gap-4 overflow-x-auto pb-1">
              {playlists.map((playlist) => (
                <div key={playlist.title} className="w-40 flex-shrink-0">
                  <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-neutral-900">
                    <img src={playlist.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                  <div className="mt-2 space-y-1">
                    <div className="truncate text-sm font-semibold text-white">{playlist.title}</div>
                    <div className="text-xs text-white/60">Curated for {artistName}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-3 border-t border-white/5 pt-4">
            <h2 className="text-lg font-semibold text-white md:text-xl">About</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Monthly listeners</p>
                <p className="text-xl font-bold text-white">2.1M</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Since</p>
                <p className="text-xl font-bold text-white">2018</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-white/60">Origin</p>
                <p className="text-xl font-bold text-white">Belgrade</p>
              </div>
            </div>
            <div className="space-y-2 text-sm leading-relaxed text-white/80">
              {aboutLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
