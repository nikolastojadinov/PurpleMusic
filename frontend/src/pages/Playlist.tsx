import { Clock3, ListMusic, Play, Shuffle, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

const tracks = [
  { title: "Glow Lines", artist: "Aya Loren", duration: "3:14", image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=400&q=60" },
  { title: "Tidal", artist: "Novi", duration: "2:52", image: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=400&q=60" },
  { title: "Horizon Drive", artist: "Jules Park", duration: "3:40", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=400&q=60" },
  { title: "Polychrome", artist: "Yuna", duration: "3:05", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=400&q=60" },
  { title: "Midnight Air", artist: "Low Tide", duration: "4:02", image: "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=400&q=60" },
];

export default function PlaylistPage() {
  const { playlistId } = useParams();
  const title = useMemo(() => playlistId?.toString() || "Evening Vibes", [playlistId]);

  const cover = "https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=1400&q=80";

  return (
    <div className="page-grid" aria-label="Playlist page">
      <section className="section-card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            background: `linear-gradient(140deg, rgba(246,198,109,0.18), rgba(8,7,15,0.94)), url(${cover}) center/cover`,
            minHeight: 220,
          }}
        >
          <div style={{ position: "absolute", top: 20, left: 20 }}>
            <div className="badge" style={{ marginBottom: 10 }}>
              <Sparkles size={14} /> Styled UI only
            </div>
            <h1 className="hero-title" style={{ margin: 0 }}>{title}</h1>
            <p className="muted" style={{ margin: "6px 0 0" }}>Playlist layout mirrored from Hajde’s design.</p>
            <div className="chip-row" style={{ marginTop: 14 }}>
              <button className="pill-button primary" type="button">
                <Play size={18} />
                Play all
              </button>
              <button className="pill-button" type="button">
                <Shuffle size={18} />
                Shuffle
              </button>
              <div className="pill-outline">
                <ListMusic size={16} /> {tracks.length} tracks
              </div>
            </div>
          </div>
        </div>

        <div style={{ padding: 22 }}>
          <div className="section-heading">
            <h2 className="section-title" style={{ margin: 0 }}>Tracklist</h2>
            <p className="muted" style={{ margin: 0 }}>Static placeholders, no player wiring yet.</p>
          </div>
          <div className="list-surface">
            {tracks.map((track, idx) => (
              <div key={track.title} className="list-row">
                <img className="thumb" src={track.image} alt="" loading="lazy" />
                <div>
                  <div className="title">{track.title}</div>
                  <div className="subtitle">{track.artist}</div>
                </div>
                <div className="pill-outline">
                  <Clock3 size={16} /> {track.duration} · #{idx + 1}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
