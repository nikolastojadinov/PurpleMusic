import { ArrowRight, Compass, Headphones, Music2, Search, Sparkles } from "lucide-react";

const featuredBoards = [
  {
    title: "Late Night Session",
    subtitle: "Glass synths, slow grooves, neon skyline.",
    tone: "midnight",
  },
  {
    title: "Indie Sunlight",
    subtitle: "Guitars with a smile and breezy hooks.",
    tone: "amber",
  },
  {
    title: "Bass Therapy",
    subtitle: "Deep lows, crisp snares, sub-bass you feel.",
    tone: "aqua",
  },
  {
    title: "Focus Flow",
    subtitle: "Lo-fi textures and gentle momentum.",
    tone: "violet",
  },
];

const editorPicks = [
  {
    title: "Afterglow Playlist",
    meta: "42 tracks • 2h 35m",
    byline: "Curated for headphone listening",
  },
  {
    title: "Crush // Covers",
    meta: "27 tracks • 1h 48m",
    byline: "Favorite songs reimagined",
  },
  {
    title: "Future Nostalgia",
    meta: "33 tracks • 2h 11m",
    byline: "Retro drums with modern sheen",
  },
];

const quickStarts = [
  { label: "Browse moods", icon: <Compass size={16} /> },
  { label: "Fresh finds", icon: <Sparkles size={16} /> },
  { label: "Chill instrumentals", icon: <Music2 size={16} /> },
];

function toneClass(tone: string): string {
  if (tone === "amber") return "linear-gradient(140deg, rgba(246,198,109,0.22), rgba(255,255,255,0.06))";
  if (tone === "aqua") return "linear-gradient(140deg, rgba(88,199,250,0.22), rgba(255,255,255,0.05))";
  if (tone === "violet") return "linear-gradient(140deg, rgba(137,111,255,0.22), rgba(255,255,255,0.05))";
  return "linear-gradient(140deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03))";
}

export default function HomePage() {
  return (
    <div className="page-grid" aria-label="PurpleMusic home">
      <section className="hero-block">
        <div className="badge">
          <Sparkles size={16} />
          Visual-only UI preview
        </div>
        <h1 className="hero-title">Sound-first surfaces, reimagined.</h1>
        <p className="hero-lede">
          The Hajde-inspired layout rebuilt for PurpleMusic. No backend calls, just the visual language, ready for your data.
        </p>
        <div className="chip-row">
          <button className="pill-button primary" type="button">
            <Search size={18} />
            Open search canvas
          </button>
          <button className="pill-button ghost" type="button">
            <Headphones size={18} />
            Start radio preview
          </button>
          <div className="pill-outline">
            <Sparkles size={15} /> Live gradients, glass cards
          </div>
        </div>
      </section>

      <section className="section-card" aria-label="Quick starts">
        <div className="section-heading">
          <div>
            <p className="muted" style={{ margin: 0 }}>Jump in</p>
            <h2 className="section-title" style={{ margin: 0 }}>Quick starts</h2>
          </div>
          <button className="pill-button" type="button">
            Explore all
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="chip-row">
          {quickStarts.map((item) => (
            <button key={item.label} className="pill-button" type="button">
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="section-card" aria-label="Featured boards">
        <div className="section-heading">
          <h2 className="section-title" style={{ margin: 0 }}>Featured boards</h2>
          <p className="muted" style={{ margin: 0 }}>Mood-first pages with cover art focus.</p>
        </div>
        <div className="card-grid">
          {featuredBoards.map((board) => (
            <article
              key={board.title}
              className="mini-card"
              style={{ backgroundImage: toneClass(board.tone), backgroundBlendMode: "screen" }}
            >
              <strong>{board.title}</strong>
              <p className="meta" style={{ margin: 0 }}>{board.subtitle}</p>
              <div className="avatar-row">
                <div className="avatar">PM</div>
                <div className="muted">Optimized for 30–60 min sessions.</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-card" aria-label="Editor picks">
        <div className="section-heading">
          <h2 className="section-title" style={{ margin: 0 }}>Editor picks</h2>
          <p className="muted" style={{ margin: 0 }}>Hand-tuned highlights that mirror Hajde’s visual rhythm.</p>
        </div>
        <div className="list-surface">
          {editorPicks.map((pick, idx) => (
            <div key={pick.title} className="list-row">
              <div className="thumb" aria-hidden>
                <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1b1b2d, #131221)" }} />
              </div>
              <div>
                <div className="title">{pick.title}</div>
                <div className="subtitle">{pick.byline}</div>
              </div>
              <div className="pill-outline">{pick.meta}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
