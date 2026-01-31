import { useMemo, useState } from "react";
import { ChevronDown, Heart, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";

type FullscreenPlayerProps = {
  title: string;
  artist: string;
  cover: string;
  isOpen: boolean;
  isPlaying: boolean;
  progress: number; // percent 0-100
  durationSeconds: number;
  volume: number;
  currentSeconds: number;
  onTogglePlay: () => void;
  onClose: () => void;
  onScrub: (value: number) => void;
  onVolume: (value: number) => void;
};

const formatTime = (totalSeconds: number) => {
  const safe = Math.max(0, Math.round(totalSeconds));
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export default function FullscreenPlayer({
  title,
  artist,
  cover,
  isOpen,
  isPlaying,
  progress,
  durationSeconds,
  volume,
  currentSeconds,
  onTogglePlay,
  onClose,
  onScrub,
  onVolume,
}: FullscreenPlayerProps) {
  const [liked, setLiked] = useState(false);
  const backgroundStyle = useMemo(
    () => ({ backgroundImage: `radial-gradient(circle at 50% 30%, rgba(124,58,237,0.25), transparent 42%), url(${cover})` }),
    [cover],
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[radial-gradient(circle_at_50%_25%,rgba(124,58,237,0.25),transparent_38%),linear-gradient(180deg,#0a0812,#05030b)] text-[#F3F1FF]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[rgba(20,14,30,0.6)] px-4 py-3 backdrop-blur">
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full border border-white/15 text-[#CFA85B] shadow-[0_6px_18px_rgba(0,0,0,0.35)] hover:text-[#F6C66D]"
          aria-label="Close player"
        >
          <ChevronDown className="mx-auto h-6 w-6" />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="h-10 w-10 rounded-full border border-white/15 text-[#8B86A3] shadow-[0_6px_18px_rgba(0,0,0,0.35)] hover:text-[#F3F1FF]"
          aria-label="Exit fullscreen"
        >
          <X className="mx-auto h-6 w-6" />
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center overflow-y-auto px-4 pb-10 pt-6">
        <div
          className="yt-player-shell is-fullscreen w-full max-w-5xl"
          style={{ ...backgroundStyle, backgroundSize: "cover", backgroundPosition: "center", aspectRatio: "16 / 9" }}
          aria-hidden
        />

        <div className="mt-8 w-full max-w-xl text-center">
          <h2 className="mb-2 text-[28px] font-bold leading-tight text-[#F6C66D] drop-shadow-[0_4px_18px_rgba(245,194,107,0.35)]">
            {title}
          </h2>
          <p className="text-sm text-[#B7B2CC]">{artist}</p>
        </div>

        <div className="mt-6 w-full max-w-xl">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => onScrub(Number(e.target.value))}
            className="w-full accent-[#F08CFF]"
            aria-label="Scrub timeline"
          />
          <div className="mt-2 flex justify-between text-xs text-[#8B86A3]">
            <span>{formatTime(currentSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-6">
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-[#F5C26B] shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:text-[#F08CFF]"
            aria-label="Previous"
          >
            <SkipBack className="h-6 w-6" />
          </button>
          <button
            type="button"
            className="pm-cta-button pm-cta-button--md flex items-center justify-center"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={onTogglePlay}
          >
            {isPlaying ? <Pause className="h-8 w-8" /> : <Play className="h-8 w-8" />}
          </button>
          <button
            type="button"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 text-[#F5C26B] shadow-[0_10px_24px_rgba(0,0,0,0.35)] hover:text-[#F08CFF]"
            aria-label="Next"
          >
            <SkipForward className="h-6 w-6" />
          </button>
        </div>

        <div className="mt-8 flex w-full max-w-xl flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setLiked((prev) => !prev)}
            className={`flex items-center gap-2 rounded-full border border-white/15 px-3 py-2 text-sm transition ${liked ? "bg-white/15 text-[#F6C66D]" : "bg-white/5 text-white"}`}
            aria-pressed={liked}
          >
            <Heart className="h-4 w-4" fill={liked ? "currentColor" : "none"} />
            <span>{liked ? "Liked" : "Like song"}</span>
          </button>

          <div className="flex w-48 items-center gap-3 text-[#8B86A3] md:w-64">
            <Volume2 className="h-5 w-5" />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={volume}
              onChange={(e) => onVolume(Number(e.target.value))}
              className="w-full accent-[#F5C26B]"
              aria-label="Volume"
            />
            <span className="w-10 text-right text-xs text-white/80">{volume}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
