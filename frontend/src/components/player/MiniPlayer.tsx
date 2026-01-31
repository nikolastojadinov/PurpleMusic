import { Pause, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useState } from "react";

// Mini player UI only: no playback or backend logic.
export default function MiniPlayer() {
  const [isPlaying] = useState(true);
  const progress = 42; // percent, static placeholder

  return (
    <div className="mini-player" role="complementary" aria-label="Mini player">
      <div className="mini-meta-block">
        <div className="mini-cover" aria-hidden>
          <img
            src="https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=240&q=80"
            alt=""
          />
        </div>
        <div className="mini-text">
          <div className="mini-title">Velvet Skyline</div>
          <div className="mini-artist">Aya Loren • Visual mock</div>
        </div>
      </div>

      <div className="mini-controls" aria-label="Playback controls">
        <button type="button" className="mini-btn ghost" aria-label="Previous">
          <SkipBack size={18} />
        </button>
        <button type="button" className="mini-btn primary" aria-label={isPlaying ? "Pause" : "Play"}>
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" className="mini-btn ghost" aria-label="Next">
          <SkipForward size={18} />
        </button>
      </div>

      <div className="mini-timeline" aria-label="Timeline">
        <div className="mini-time">0:48</div>
        <div className="mini-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
          <div className="mini-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="mini-time">3:28</div>
      </div>

      <div className="mini-actions">
        <button type="button" className="mini-btn ghost" aria-label="Volume">
          <Volume2 size={18} />
        </button>
      </div>
    </div>
  );
}
