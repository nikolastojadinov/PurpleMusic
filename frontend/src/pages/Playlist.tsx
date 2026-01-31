import { ListMusic, Play, Shuffle, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

const tracks = [
  { title: "Glow Lines", artist: "Aya Loren", duration: "3:14", image: "https://images.unsplash.com/photo-1501612780327-45045538702b?auto=format&fit=crop&w=600&q=80" },
  { title: "Tidal", artist: "Novi", duration: "2:52", image: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=600&q=80" },
  { title: "Horizon Drive", artist: "Jules Park", duration: "3:40", image: "https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=600&q=80" },
  { title: "Polychrome", artist: "Yuna", duration: "3:05", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80" },
  { title: "Midnight Air", artist: "Low Tide", duration: "4:02", image: "https://images.unsplash.com/photo-1507878866276-a947ef722fee?auto=format&fit=crop&w=600&q=80" },
];

export default function PlaylistPage() {
  const { playlistId, albumId } = useParams();
  const identifier = playlistId ?? albumId;
  const title = useMemo(() => identifier?.toString() || "Evening Vibes", [identifier]);
  const cover = "https://images.unsplash.com/photo-1521336575822-6da63fb45455?auto=format&fit=crop&w=1400&q=80";

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-white/10 bg-black/40 shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
        <div
          className="relative min-h-[220px] w-full"
          style={{ backgroundImage: `linear-gradient(140deg, rgba(246,198,109,0.18), rgba(8,7,15,0.94)), url(${cover})`, backgroundSize: "cover", backgroundPosition: "center" }}
        >
          <div className="absolute left-4 top-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-[#F6C66D]">
              <Sparkles className="h-4 w-4" /> Styled UI only
            </div>
          </div>
          <div className="absolute bottom-6 left-0 w-full px-4 md:px-6">
            <h1 className="text-3xl font-bold text-white drop-shadow md:text-4xl">{title}</h1>
            <p className="text-sm text-white/70">Playlist layout mirrored from hajde-music-stream.</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button className="pm-cta-pill" type="button">
                <span className="pm-cta-pill-inner">
                  <Play className="h-4 w-4" /> Play all
                </span>
              </button>
              <button className="pm-cta-pill pm-cta-pill--subtle" type="button">
                <span className="pm-cta-pill-inner">
                  <Shuffle className="h-4 w-4" /> Shuffle
                </span>
              </button>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                <ListMusic className="mr-2 inline-block h-4 w-4" /> {tracks.length} tracks
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 px-4 py-6 md:px-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white md:text-xl">Tracklist</h2>
              <p className="text-xs text-white/60">Static placeholders, no playback wiring.</p>
            </div>
          </div>
          <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-black/60 shadow-2xl">
            {tracks.map((track, idx) => (
              <div key={track.title} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5">
                <div className="text-sm font-semibold text-white/70">{idx + 1}</div>
                <div className="h-12 w-12 overflow-hidden rounded-md border border-white/10 bg-neutral-800">
                  <img src={track.image} alt="" className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-white">{track.title}</div>
                  <div className="truncate text-xs text-white/60">{track.artist}</div>
                </div>
                <div className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70">{track.duration}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
