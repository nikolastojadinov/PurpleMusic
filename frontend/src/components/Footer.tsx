import { Home, ListMusic, Search } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "Home", icon: Home },
  { to: "/playlist/demo", label: "Playlist", icon: ListMusic },
  { to: "/search", label: "Search", icon: Search },
];

const itemClasses = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center gap-1 text-xs font-semibold transition ${
    isActive ? "text-[#F6C66D]" : "text-[#CFA85B] hover:text-[#F6C66D]"
  }`;

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 h-[72px] border-t border-white/10 bg-[rgba(14,12,22,0.9)] backdrop-blur-[18px] shadow-[0_-14px_38px_rgba(0,0,0,0.35)] md:hidden">
      <div className="mx-auto flex h-full max-w-3xl items-center justify-around px-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to} className={itemClasses}>
              <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/0">
                <Icon className="h-5 w-5" />
              </span>
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </footer>
  );
}
