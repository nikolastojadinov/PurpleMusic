import { Home, Plus, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/create", label: "Create", icon: Plus },
  { to: "/search", label: "Search", icon: Search },
];

export default function Footer() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 h-[76px] border-t border-[rgba(255,255,255,0.06)] bg-[rgba(14,12,22,0.88)] shadow-[0_-14px_38px_rgba(0,0,0,0.35)] backdrop-blur-[18px] md:hidden">
      <div className="mx-auto flex h-full max-w-4xl items-center justify-around px-4 md:px-6">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to);
          const isCreate = item.to === "/create";

          if (isCreate) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="relative -mt-5 inline-flex"
                aria-label={item.label}
              >
                <span className="pm-cta-circle">
                  <span className="pm-cta-circle-inner">
                    <Icon className="h-6 w-6 stroke-[2.2] text-[#FFD77A]" />
                  </span>
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-1 px-4 py-2 text-xs font-semibold transition-all ${
                active ? "text-[#F6C66D]" : "text-[#CFA85B] hover:text-[#F6C66D]"
              }`}
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/10 ${active ? "bg-white/10" : "bg-white/0"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
