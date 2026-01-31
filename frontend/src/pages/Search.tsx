import { useMemo, useState } from "react";
import { Clock3, Loader2, Music2, Search as SearchIcon, Sparkles, UserRound } from "lucide-react";

const suggestionSeeds = [
  { id: "s1", title: "Glass Heart", subtitle: "Alt pop • 3:12", type: "track" },
  { id: "s2", title: "Midnight Bloom", subtitle: "Artist", type: "artist" },
  { id: "s3", title: "Lo-Fi Sketches", subtitle: "Playlist • 42 tracks", type: "playlist" },
  { id: "s4", title: "Analog Dreams", subtitle: "Album", type: "album" },
  { id: "s5", title: "Desert Echoes", subtitle: "Artist", type: "artist" },
];

const activitySeeds = [
  { id: "a1", title: "Kept Me Close", subtitle: "Played 2h ago", type: "track" },
  { id: "a2", title: "Sundown Sketches", subtitle: "Queued yesterday", type: "playlist" },
  { id: "a3", title: "Echo Lines", subtitle: "Searched 2d ago", type: "artist" },
];

const recentQueries = ["ambient piano", "purple music", "city pop"];

const iconFor = (type: string) => {
  const t = type.toLowerCase();
  if (t === "track" || t === "song") return <Music2 className="h-4 w-4" />;
  if (t === "artist") return <UserRound className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
};

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestionSeeds;
    return suggestionSeeds.filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#0e0b19] via-[#0c0a14] to-[#120f27] p-6 shadow-[0_18px_48px_rgba(0,0,0,0.45)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-[#F6C66D]">
          <SearchIcon className="h-4 w-4" /> Local-only search
        </div>
        <h1 className="mt-3 text-3xl font-bold leading-tight text-white md:text-4xl">Search the mock index</h1>
        <p className="mt-2 max-w-2xl text-sm text-white/70 md:text-base">The hajde search canvas, filtered client-side. No external calls—just visuals.</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-white/60" htmlFor="search-box">
            Search
          </label>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <input
              id="search-box"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artists, tracks, playlists..."
              className="h-12 w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-3 text-base text-white placeholder:text-white/40 focus:border-white/25 focus:outline-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white md:text-xl">Suggestions</h2>
          <span className="text-xs text-white/60">Static list filtered locally</span>
        </div>
        {query && filteredSuggestions.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" />
            No matches for this query.
          </div>
        ) : null}
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {filteredSuggestions.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80">
                {iconFor(item.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                <div className="truncate text-xs text-white/60">{item.subtitle}</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{item.type}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white md:text-xl">Recent activity</h2>
          <span className="text-xs text-white/60">Mirrors hajde history rows</span>
        </div>
        <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {activitySeeds.map((item) => (
            <div key={item.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80">
                {iconFor(item.type)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-white">{item.title}</div>
                <div className="truncate text-xs text-white/60">{item.subtitle}</div>
              </div>
              <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{item.type}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white md:text-xl">Recent searches</h2>
          <p className="text-xs text-white/60">Tap a chip to reuse the query.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {recentQueries.map((q) => (
            <button
              key={q}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white transition hover:border-white/25 hover:bg-white/10"
              type="button"
              onClick={() => setQuery(q)}
            >
              <Clock3 className="mr-2 inline-block h-4 w-4" />
              {q}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
