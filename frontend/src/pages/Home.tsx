import { Search as SearchIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      <button
        type="button"
        onClick={() => navigate("/search")}
        className="relative flex h-11 w-full items-center gap-3 rounded-full border border-neutral-800 bg-neutral-900/85 px-4 text-left text-sm text-neutral-400 transition hover:bg-neutral-900"
        aria-label="Otvori pretragu"
      >
        <span className="absolute inset-0 rounded-full border border-white/10" aria-hidden />
        <SearchIcon className="h-5 w-5 text-white/70" />
        <span className="truncate text-[15px] text-white/70">Traži pesme, izvođače, albume...</span>
      </button>
    </div>
  );
}
