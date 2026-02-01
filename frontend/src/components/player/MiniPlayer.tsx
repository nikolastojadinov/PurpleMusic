import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { usePlayer } from "../../lib/playerContext";

export default function MiniPlayer() {
  const {
    isPlaying,
    currentTitle,
    currentArtist,
    currentThumbnailUrl,
    isFullscreen,
    isPlayerVisible,
    currentTime,
    duration,
    formatTime,
    togglePlay,
    skipBackward,
    skipForward,
    setIsFullscreen,
  } = usePlayer();

  if (!isPlayerVisible || isFullscreen) return null;

  const title = currentTitle || "Now playing";
  const artist = currentArtist || "YouTube Music";
  const cover = currentThumbnailUrl || "https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=640&q=80";
  const progress = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <div className="fixed left-0 right-0 z-30 bottom-[76px] md:bottom-6">
      <div
        className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[rgba(10,8,15,0.9)] px-3 py-3 shadow-[0_-12px_32px_rgba(0,0,0,0.4)] backdrop-blur-md"
        role="button"
        tabIndex={0}
        onClick={() => setIsFullscreen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsFullscreen(true);
          }
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-xl border border-white/10 bg-[rgba(20,14,30,0.65)]" aria-hidden>
            <div
              className="absolute inset-0"
              style={{ backgroundImage: `url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }}
            />
            <div id="yt-player-slot-mini" className="absolute inset-0" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white/90">{title}</p>
            <p className="truncate text-xs text-neutral-400">{artist}</p>
          </div>
        </div>

        <div className="hidden items-center gap-2 text-xs text-neutral-400 md:flex" aria-label="Timeline">
          <span className="w-8 text-right">{formatTime(currentTime)}</span>
          <div className="relative h-2 w-52 overflow-hidden rounded-full bg-white/10">
            <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#F5C26B] via-[#F08CFF] to-[#7B3FE4]" style={{ width: `${progress}%` }} />
          </div>
          <span className="w-8">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2 pr-1">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition hover:text-white"
            aria-label="Previous"
            onClick={(e) => {
              e.stopPropagation();
              skipBackward();
            }}
          >
            <SkipBack className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="pm-cta-button pm-cta-button--sm flex items-center justify-center"
            aria-label={isPlaying ? "Pause" : "Play"}
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition hover:text-white"
            aria-label="Next"
            onClick={(e) => {
              e.stopPropagation();
              skipForward();
            }}
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
