import { useMemo } from "react";
import { ArrowLeft, Clock3, Heart, Play, Shuffle, Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";

const sampleSongs = [
  { title: "Velvet Skyline", subtitle: "3:22", image: "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=400&q=60" },
  { title: "Glass Atlas", subtitle: "2:58", image: "https://images.unsplash.com/photo-1483412033650-1015ddeb83d1?auto=format&fit=crop&w=400&q=60" },
  { title: "Neon Letters", subtitle: "3:47", image: "https://images.unsplash.com/photo-1464375117522-1311d6a5b81f?auto=format&fit=crop&w=400&q=60" },
  { title: "Polaroid Bloom", subtitle: "4:02", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=60" },
];

const aboutLines = [
  "Hajde-style hero with layered gradients and soft glow.",
  "This is a purely visual mock — no playback, no backend calls.",
  "Use this canvas to wire real artist data later.",
];

export default function ArtistPage() {
  const { artistId } = useParams();
  const artistName = useMemo(() => artistId?.toString() || "Serene Echoes", [artistId]);

  const heroImage = "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=1600&q=80";

  return (
    <div className="page-grid" aria-label="Artist page">
      <section className="section-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            minHeight: 260,
            background: `linear-gradient(160deg, rgba(246,198,109,0.24), rgba(8,7,15,0.9)), url(${heroImage}) center/cover`,
          }}
        >
          <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 8 }}>
            <button className="pill-button ghost" type="button">
              <ArrowLeft size={18} />
              Back
            </button>
          </div>
          <div style={{ position: "absolute", bottom: 22, left: 22 }}>
            <p className="badge" style={{ marginBottom: 8 }}>
              <Sparkles size={14} /> Visual placeholder
            </p>
            <h1 className="hero-title" style={{ margin: 0 }}>{artistName}</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>Artist layout from Hajde, redesigned for PurpleMusic.</p>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div className="chip-row" style={{ marginBottom: 14 }}>
            <button className="pill-button primary" type="button">
              <Play size={18} />
              Play preview
            </button>
            <button className="pill-button" type="button">
              <Shuffle size={18} />
              Shuffle
            </button>
            <button className="pill-button ghost" type="button">
              <Heart size={18} />
              Follow
            </button>
          </div>

          <div className="section-heading" style={{ marginTop: 6 }}>
            <h2 className="section-title" style={{ margin: 0 }}>Popular songs</h2>
            <p className="muted" style={{ margin: 0 }}>Static list only.</p>
          </div>

          <div className="list-surface">
            {sampleSongs.map((song, idx) => (
              <div key={song.title} className="list-row">
                <img className="thumb" src={song.image} alt="" loading="lazy" />
                <div>
                  <div className="title">{song.title}</div>
                  <div className="subtitle">{song.subtitle}</div>
                </div>
                <div className="pill-outline">
                  <Clock3 size={16} /> {idx + 1}
                </div>
              </div>
            ))}
          </div>

          <div className="section-divider" />

          <div className="section-heading">
            <h2 className="section-title" style={{ margin: 0 }}>About</h2>
          </div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-label">Monthly listeners</div>
              <div className="stat-value">2.1M</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Since</div>
              <div className="stat-value">2018</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Origin</div>
              <div className="stat-value">Belgrade</div>
            </div>
          </div>

          <div style={{ marginTop: 14, color: "#d9d9e8", lineHeight: 1.7 }}>
            {aboutLines.map((line) => (
              <p key={line} style={{ margin: "6px 0" }}>
                {line}
              </p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
