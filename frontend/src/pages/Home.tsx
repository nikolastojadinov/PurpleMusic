import { ArrowRight, Flame, Music2, Search, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const trending = [
  { title: "Midnight Drive", subtitle: "Synthwave • Neon", image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=900&q=80" },
  { title: "Glass Heart", subtitle: "Alt pop • Fresh", image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=900&q=80" },
  { title: "Future Nostalgia", subtitle: "Retro drums", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=900&q=80" },
];

const mostPopular = [
  { title: "Velvet Skyline", artist: "Aya Loren", duration: "3:22", image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=600&q=80" },
  { title: "Tidal", artist: "Novi", duration: "2:58", image: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=600&q=80" },
  { title: "Polychrome", artist: "Yuna", duration: "3:05", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80" },
];

const newReleases = [
  { title: "Analog Bloom", subtitle: "Album", year: "2024", image: "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=600&q=80" },
  { title: "Crush // Covers", subtitle: "Playlist", year: "2024", image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=600&q=80" },
  { title: "Indie Sunlight", subtitle: "Album", year: "2025", image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=600&q=80" },
  { title: "Bass Therapy", subtitle: "Playlist", year: "2024", image: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=600&q=80" },
];

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e0b19] via-[#0c0a14] to-[#120f27] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#F6C66D]">
          <Sparkles className="h-4 w-4" />
          Hajde visual system
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-4xl">Sound-first surfaces, rebuilt.</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70 md:text-base">
          The PurpleMusic front-end now mirrors the hajde-music-stream layout. Static data only—wire your backend when ready.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            to="/search"
            className="pm-cta-pill"
            aria-label="Open search"
          >
            <span className="pm-cta-pill-inner">
              <Search className="h-4 w-4" />
              Open search
            </span>
          </Link>
          <Link
            to="/playlist/demo"
            className="pm-cta-pill pm-cta-pill--subtle"
            aria-label="Play the demo playlist"
          >
            <span className="pm-cta-pill-inner">
              <Music2 className="h-4 w-4" />
              Play demo playlist
            </span>
          </Link>
          <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70">
            <Sparkles className="mr-2 inline-block h-4 w-4 text-[#F6C66D]" /> Glass cards and gradients
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-white/50">Trending now</p>
            <h2 className="text-xl font-semibold text-white">Handpicked highlights</h2>
          </div>
          <Link to="/search" className="flex items-center gap-2 text-sm font-semibold text-[#F6C66D] hover:text-[#ffde8a]">
            Browse all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {trending.map((item) => (
            <article
              key={item.title}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,10,20,0.72)] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
              style={{ minHeight: 180 }}
            >
              <div
                className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-105"
                style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.72)), url(${item.image})` }}
                aria-hidden
              />
              <div className="relative flex h-full flex-col justify-end p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/70">Featured</p>
                <h3 className="text-lg font-bold text-white">{item.title}</h3>
                <p className="text-sm text-white/70">{item.subtitle}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">Most popular</h2>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">Live demo</span>
        </div>
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
          {mostPopular.map((item, idx) => (
            <div key={item.title} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5">
              <div className="text-sm font-semibold text-white/70">{idx + 1}</div>
              <div className="h-12 w-12 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                <div className="truncate text-xs text-white/60">{item.artist}</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{item.duration}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.12em] text-white/50">New releases</p>
            <h2 className="text-xl font-semibold text-white">Fresh in PurpleMusic</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
            <Flame className="h-4 w-4 text-[#F6C66D]" /> Updated weekly
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {newReleases.map((item) => (
            <div
              key={item.title}
              className="group overflow-hidden rounded-2xl border border-white/10 bg-[rgba(12,10,20,0.72)] shadow-[0_16px_40px_rgba(0,0,0,0.45)]"
            >
              <div className="h-40 overflow-hidden">
                <img
                  src={item.image}
                  alt=""
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <div className="space-y-1 px-3 py-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>{item.subtitle}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">{item.year}</span>
                </div>
                <h3 className="truncate text-sm font-semibold text-white">{item.title}</h3>
                <p className="text-xs text-white/60">PurpleMusic visuals • Static data</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
