import { useEffect, useRef, useState } from "react";
import { FileText, Globe2, LogOut, Shield, User } from "lucide-react";
import { Link } from "react-router-dom";

import appLogo from "../assets/app-logo.png";

const menuItems = [
  { label: "My account", icon: User },
  { label: "Language", icon: Globe2 },
  { label: "Privacy policy", icon: Shield },
  { label: "Terms of service", icon: FileText },
  { label: "Sign out", icon: LogOut, tone: "danger" as const },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header
      data-app-header="main"
      className="fixed top-0 left-0 right-0 z-40 h-16 border-b border-white/10 bg-[rgba(7,6,11,0.9)] shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
    >
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 md:px-6">
        <Link to="/" className="group flex items-center gap-3" aria-label="PurpleMusic home">
          <img
            src={appLogo}
            alt="PurpleMusic"
            className="h-12 w-12 flex-shrink-0 drop-shadow-[0_4px_18px_rgba(246,198,109,0.28)]"
          />
          <span className="text-[22px] font-bold tracking-tight text-[#F6C66D] drop-shadow-[0_0_12px_rgba(246,198,109,0.35)]">
            PurpleMusic
          </span>
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#141126] text-[#F6C66D] shadow-[0_10px_24px_rgba(0,0,0,0.35)] transition hover:border-white/25 hover:scale-[1.01]"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Profile menu"
            aria-expanded={open}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f0c1d]">
              <User className="h-5 w-5" />
            </span>
          </button>

          {open ? (
            <div className="absolute right-0 top-[calc(100%+12px)] w-64 rounded-2xl border border-white/10 bg-[rgba(20,17,38,0.92)] p-2 shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur-xl">
              <div className="flex items-center gap-3 rounded-xl px-3 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0f0c1d] text-[#F6C66D]">
                  <User className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-white/60">My account</p>
                  <p className="truncate text-sm font-semibold text-white">Guest</p>
                </div>
              </div>
              <div className="my-1 h-px bg-white/10" />
              <div className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white transition hover:bg-white/5 ${
                        item.tone === "danger" ? "text-red-300 hover:text-red-200" : ""
                      }`}
                      onClick={() => setOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
