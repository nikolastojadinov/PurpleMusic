import { useEffect, useMemo, useState } from "react";

import { usePlayer } from "../../lib/playerContext";

type PlayerRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

function readAnchorRect(id: string): PlayerRect | null {
  if (typeof window === "undefined") return null;
  const el = document.getElementById(id);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top + window.scrollY,
    left: rect.left + window.scrollX,
    width: rect.width,
    height: rect.height,
  };
}

export default function YouTubePlayerContainer() {
  const { isFullscreen, isPlayerVisible } = usePlayer();
  const [rect, setRect] = useState<PlayerRect | null>(null);

  const anchorId = isFullscreen ? "yt-player-slot-fullscreen" : "yt-player-slot-mini";
  const fallback: PlayerRect = useMemo(
    () =>
      isFullscreen
        ? { top: 92, left: 0, width: 960, height: 540 }
        : { top: 0, left: 16, width: 200, height: 200 },
    [isFullscreen]
  );

  useEffect(() => {
    if (!isPlayerVisible) return;

    const updateRect = () => {
      const measured = readAnchorRect(anchorId);
      setRect(measured ?? fallback);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [anchorId, fallback, isPlayerVisible]);

  const wrapperStyles = rect
    ? {
        zIndex: isFullscreen ? 55 : 31,
        position: "absolute" as const,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        pointerEvents: "none" as const,
      }
    : {
        zIndex: isFullscreen ? 55 : 31,
        position: "fixed" as const,
        top: isFullscreen ? 92 : 0,
        left: isFullscreen ? "50%" : 16,
        transform: isFullscreen ? "translateX(-50%)" : undefined,
        width: isFullscreen ? "min(960px, 90vw)" : "200px",
        height: isFullscreen ? "auto" : "200px",
        aspectRatio: isFullscreen ? "16 / 9" : undefined,
        pointerEvents: "none" as const,
      };

  return (
    <div
      id={isFullscreen ? "yt-player-wrapper-fullscreen" : "yt-player-wrapper-mini"}
      className={`yt-player-shell ${isFullscreen ? "is-fullscreen" : "is-mini"}`}
      style={{ ...wrapperStyles, visibility: isPlayerVisible ? "visible" : "hidden" }}
    >
      <div className="yt-player-frame">
        <div id="yt-player" className="yt-player-node" />
      </div>
    </div>
  );
}
