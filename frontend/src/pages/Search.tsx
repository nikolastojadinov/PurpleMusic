import { useMemo, useState } from "react";
import { Clock3, Loader2, Music2, Search as SearchIcon, Sparkles, UserRound } from "lucide-react";

const suggestionSeeds = [
  { id: "s1", title: "Glass Heart", subtitle: "Alt pop • 3:12", type: "song" },
  { id: "s2", title: "Midnight Bloom", subtitle: "Artist", type: "artist" },
  { id: "s3", title: "Lo-Fi Sketches", subtitle: "Playlist • 42 tracks", type: "playlist" },
  { id: "s4", title: "Analog Dreams", subtitle: "Album", type: "album" },
  { id: "s5", title: "Desert Echoes", subtitle: "Artist", type: "artist" },
];

const activitySeeds = [
  { id: "a1", title: "Kept Me Close", subtitle: "Played 2h ago", type: "song" },
  { id: "a2", title: "Sundown Sketches", subtitle: "Queued yesterday", type: "playlist" },
  { id: "a3", title: "Echo Lines", subtitle: "Searched 2d ago", type: "artist" },
];

const recentQueries = ["ambient piano", "purple music", "city pop" ];

function iconFor(type: string) {
  const t = type.toLowerCase();
  if (t === "song" || t === "track") return <Music2 size={16} />;
  if (t === "artist") return <UserRound size={16} />;
  return <Sparkles size={16} />;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const filteredSuggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return suggestionSeeds;
    return suggestionSeeds.filter((item) => item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className="page-grid" aria-label="Search page">
      <section className="hero-block">
        <div className="badge">
          <SearchIcon size={16} />
          Local-only search mock
        </div>
        <h1 className="hero-title">Search without hitting any APIs.</h1>
        <p className="hero-lede">
          The Hajde search canvas, visually matched. Type to filter the mocked suggestions and activity.
        </p>
        <div className="section-card" style={{ marginTop: 18, borderRadius: 18, padding: 14 }}>
          <label className="muted" style={{ display: "block", marginBottom: 8 }} htmlFor="search-box">Search</label>
          <div style={{ position: "relative" }}>
            <SearchIcon className="muted" size={18} style={{ position: "absolute", left: 12, top: 12 }} />
            <input
              id="search-box"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Artists, tracks, playlists..."
              style={{
                width: "100%",
                height: 46,
                padding: "0 14px 0 38px",
                borderRadius: 14,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)",
                color: "#fff",
                fontSize: "1rem",
                outline: "none",
              }}
            />
          </div>
        </div>
      </section>

      <section className="section-card" aria-label="Suggestions">
        <div className="section-heading">
          <h2 className="section-title" style={{ margin: 0 }}>Suggestions</h2>
          <p className="muted" style={{ margin: 0 }}>Static list filtered on the client.</p>
        </div>
        {query && filteredSuggestions.length === 0 ? (
          <div className="muted" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 className="muted" size={16} />
            No matches for this query.
          </div>
        ) : null}
        <div className="list-surface" role="list">
          {filteredSuggestions.map((item) => (
            <div key={item.id} className="list-row" role="listitem">
              <div className="thumb" aria-hidden>
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1b1b2d, #131221)" }} />
              </div>
              <div>
                <div className="title">{item.title}</div>
                <div className="subtitle">{item.subtitle}</div>
              </div>
              <div className="pill-outline">
                {iconFor(item.type)}
                {item.type}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card" aria-label="Recent activity">
        <div className="section-heading">
          <h2 className="section-title" style={{ margin: 0 }}>Recent activity</h2>
          <p className="muted" style={{ margin: 0 }}>Mirrors the layout of Hajde history rows.</p>
        </div>
        <div className="list-surface">
          {activitySeeds.map((item) => (
            <div key={item.id} className="list-row">
              <div className="thumb" aria-hidden>
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #19192b, #0f0e20)" }} />
              </div>
              <div>
                <div className="title">{item.title}</div>
                <div className="subtitle">{item.subtitle}</div>
              </div>
              <div className="pill-outline">
                {iconFor(item.type)}
                {item.type}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-card" aria-label="Recent searches">
        <div className="section-heading">
          <h2 className="section-title" style={{ margin: 0 }}>Recent searches</h2>
          <p className="muted" style={{ margin: 0 }}>Tap a chip to reuse the query.</p>
        </div>
        <div className="chip-row">
          {recentQueries.map((q) => (
            <button key={q} className="pill-button" type="button" onClick={() => setQuery(q)}>
              <Clock3 size={16} />
              {q}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
