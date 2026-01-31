import { useMemo, useState } from "react";
import { ChevronDown, Heart, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";

const formatTime = (totalSeconds: number) => {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function FullscreenPlayer() {
  const [isOpen, setIsOpen] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [liked, setLiked] = useState(false);
  const [progress, setProgress] = useState(38);
  const [volume, setVolume] = useState(72);

  const durationSeconds = 232;
  const currentSeconds = useMemo(() => Math.round((progress / 100) * durationSeconds), [progress, durationSeconds]);

  if (!isOpen) return null;

  return (
    <div className="fs-player-overlay" role="dialog" aria-label="Fullscreen player">
      <div className="fs-top-bar">
        <div className="fs-pill">Now playing</div>
        <div className="fs-top-actions">
          <button
            type="button"
            className="fs-icon-btn"
            aria-label="Minimize player"
            onClick={() => setIsOpen(false)}
          >
            <ChevronDown size={22} />
          </button>
          <button
            type="button"
            className="fs-icon-btn subtle"
            aria-label="Close player"
            onClick={() => setIsOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="fs-player-body">
        <div className="fs-video-shell" aria-hidden>
          <div className="fs-video-hero" />
          <div className="fs-video-bleed" />
        </div>

        <div className="fs-meta">
          <h2 className="fs-title">Velvet Skyline</h2>
          <p className="fs-artist">Aya Loren - Visual mock</p>
        </div>

        <div className="fs-progress">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => setProgress(Number(e.target.value))}
            aria-label="Scrub timeline"
          />
          <div className="fs-time-row" aria-hidden>
            <span>{formatTime(currentSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
        </div>

        <div className="fs-controls" aria-label="Playback controls">
          <button type="button" className="fs-circle-btn ghost" aria-label="Previous">
            <SkipBack size={22} />
          </button>
          <button
            type="button"
            className="fs-circle-btn primary"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={() => setIsPlaying((prev) => !prev)}
          >
            {isPlaying ? <Pause size={26} /> : <Play size={26} />}
          </button>
          <button type="button" className="fs-circle-btn ghost" aria-label="Next">
            <SkipForward size={22} />
          </button>
        </div>

        <div className="fs-actions" aria-label="Secondary actions">
          <button
            type="button"
            className={`fs-like-btn ${liked ? "active" : ""}`}
            aria-pressed={liked}
            onClick={() => setLiked((prev) => !prev)}
          >
            <Heart size={16} fill={liked ? "currentColor" : "none"} />
            <span>{liked ? "Liked" : "Like song"}</span>
          </button>

          <div className="fs-volume" aria-label="Volume">
            <Volume2 size={18} className="fs-volume-icon" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              aria-label="Volume"
            />
            <span className="fs-volume-value">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
