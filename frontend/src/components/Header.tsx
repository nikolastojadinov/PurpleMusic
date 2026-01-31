import { Flame, Home, ListMusic, Search, Sparkles } from "lucide-react";
import { Link, NavLink } from "react-router-dom";

const navLinks = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/playlist/demo", label: "Playlist", icon: ListMusic },
  { to: "/artist/demo", label: "Artist", icon: Flame },
];

const navClasses = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? "border-white/20 bg-white/10 text-[#F6C66D] shadow-[0_0_18px_rgba(246,198,109,0.25)]"
      : "border-white/5 bg-white/0 text-white/80 hover:border-white/20 hover:bg-white/5"
  }`;

export default function Header() {
  return (
    <header
      data-app-header="main"
      className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-white/10 bg-[rgba(7,6,11,0.9)] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="flex items-center gap-3" aria-label="PurpleMusic home">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[#F6C66D] via-[#F08CFF] to-[#7B3FE4] text-[#0c0a14] shadow-[0_8px_22px_rgba(0,0,0,0.35)]">
            <span className="text-base font-black">PM</span>
          </div>
          <span className="text-lg font-bold tracking-tight text-[#F6C66D] drop-shadow-[0_0_12px_rgba(246,198,109,0.35)]">
            PurpleMusic
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navLinks.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink key={link.to} to={link.to} className={navClasses}>
                <Icon className="h-4 w-4" />
                {link.label}
              </NavLink>
            );
          })}
        </nav>

        <Link
          to="/search"
          className="group flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition hover:border-white/25 hover:text-white"
        >
          <Sparkles className="h-4 w-4 text-[#F6C66D]" />
          Quick search
        </Link>
      </div>
    </header>
  );
}
