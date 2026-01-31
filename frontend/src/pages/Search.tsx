import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2, Music2, Search as SearchIcon, Sparkles, UserRound } from "lucide-react";

import { getSupabaseClient } from "../lib/supabaseClient";

type SearchResult = {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl?: string | null;
  type: "track" | "artist" | "album" | "playlist";
};

const iconFor = (type: string) => {
  const t = type.toLowerCase();
  if (t === "track" || t === "song") return <Music2 className="h-4 w-4" />;
  if (t === "artist") return <UserRound className="h-4 w-4" />;
  return <Sparkles className="h-4 w-4" />;
};

const normalize = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

const toResult = (raw: any, fallbackType: SearchResult["type"]): SearchResult | null => {
  const id = normalize(raw?.id) || normalize(raw?.externalId) || normalize(raw?.videoId);
  if (!id) return null;
  const title = normalize(raw?.title) || normalize(raw?.name) || id;
  const subtitle = normalize(raw?.subtitle) || normalize(raw?.description) || null;
  const imageUrl = normalize(raw?.imageUrl) || normalize(raw?.thumbnail) || normalize(raw?.thumbnailUrl) || null;
  const type = (normalize(raw?.type) as SearchResult["type"]) || fallbackType;
  return { id, title, subtitle, imageUrl, type };
};

async function fetchFromSupabase(q: string, limitPerType = 8): Promise<SearchResult[]> {
  const client = getSupabaseClient();
  const term = `%${q}%`;

  const [tracks, artists, albums, playlists] = await Promise.all([
    client
      .from("tracks")
      .select("id,title,artist_key,image_url,cover_url,external_id")
      .ilike("title", term)
      .limit(limitPerType),
    client
      .from("artists")
      .select("id,name,display_name,image_url")
      .ilike("name", term)
      .limit(limitPerType),
    client
      .from("albums")
      .select("id,title,cover_url,album_type")
      .ilike("title", term)
      .limit(limitPerType),
    client
      .from("playlists")
      .select("id,title,description,cover_url")
      .ilike("title", term)
      .limit(limitPerType),
  ]);

  const firstError = [tracks.error, artists.error, albums.error, playlists.error].find(Boolean);
  if (firstError) {
    throw new Error(firstError.message || "Supabase query failed");
  }

  const mapped: SearchResult[] = [];

  (tracks.data || []).forEach((t: any) => {
    mapped.push(
      toResult(
        {
          id: t.id,
          title: t.title,
          subtitle: t.artist_key,
          imageUrl: t.cover_url || t.image_url,
        },
        "track"
      )!
    );
  });

  (artists.data || []).forEach((a: any) => {
    mapped.push(
      toResult(
        {
          id: a.id,
          title: a.display_name || a.name,
          subtitle: a.name,
          imageUrl: a.image_url,
        },
        "artist"
      )!
    );
  });

  (albums.data || []).forEach((a: any) => {
    mapped.push(
      toResult(
        {
          id: a.id,
          title: a.title,
          subtitle: a.album_type,
          imageUrl: a.cover_url,
        },
        "album"
      )!
    );
  });

  (playlists.data || []).forEach((p: any) => {
    mapped.push(
      toResult(
        {
          id: p.id,
          title: p.title,
          subtitle: p.description,
          imageUrl: p.cover_url,
        },
        "playlist"
      )!
    );
  });

  return mapped;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    document.body.classList.add("search-page");
    return () => document.body.classList.remove("search-page");
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!q) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      void runSuggest(q);
    }, 220);
  }, [query]);

  const runSearch = async (q: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchFromSupabase(q, 12);
      setResults(data);
    } catch (err: any) {
      console.warn("[search] failed", err?.message || err);
      setError("Nije moguće učitati rezultate iz baze. Proveri Supabase kredencijale.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const runSuggest = async (q: string) => {
    setSuggestLoading(true);
    try {
      const data = await fetchFromSupabase(q, 4);
      setSuggestions(data.slice(0, 8));
    } catch (err: any) {
      console.warn("[search] suggest failed", err?.message || err);
      setSuggestions([]);
    } finally {
      setSuggestLoading(false);
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    void runSearch(q);
  };

  const groupedResults = useMemo(() => {
    const sections: Record<SearchResult["type"], SearchResult[]> = { track: [], artist: [], album: [], playlist: [] };
    results.forEach((item) => {
      const key = item.type || "track";
      sections[key] = [...(sections[key] || []), item];
    });
    return sections;
  }, [results]);

  const Thumb = ({ imageUrl, fallback }: { imageUrl: string | null | undefined; fallback: JSX.Element }) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" className="h-9 w-9 rounded-full object-cover" />;
    }
    return (
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-white/80" aria-hidden>
        {fallback}
      </span>
    );
  };

  const renderResults = () => {
    if (!query.trim()) return null;

    if (loading) {
      return (
        <div className="mt-6 flex items-center gap-2 text-sm text-white/70">
          <Loader2 className="h-4 w-4 animate-spin" />
          Učitavanje rezultata...
        </div>
      );
    }

    if (error) {
      return (
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-100">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      );
    }

    const total = results.length;
    if (!total) {
      return (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/70">
          Nema rezultata za "{query.trim()}".
        </div>
      );
    }

    return (
      <div className="mt-6 space-y-6">
        {(["artist", "track", "album", "playlist"] as SearchResult["type"][]).map((section) => {
          const items = groupedResults[section];
          if (!items?.length) return null;
          return (
            <section key={section} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                {iconFor(section)}
                <span className="uppercase tracking-[0.14em] text-white/70">{section}</span>
              </div>
              <div className="divide-y divide-white/5 rounded-xl border border-white/5">
                {items.map((item) => {
                  const isArtist = section === "artist";
                  const Wrapper: any = isArtist ? "button" : "div";

                  return (
                    <Wrapper
                      key={`${section}-${item.id}`}
                      className={`flex items-center gap-3 bg-white/0 px-4 py-3 text-left text-sm text-white ${
                        isArtist ? "w-full text-left hover:bg-white/5" : ""
                      }`}
                      {...(isArtist
                        ? {
                            type: "button",
                            onClick: () => navigate(`/artist/${item.id}`),
                          }
                        : {})}
                    >
                      <Thumb imageUrl={item.imageUrl} fallback={iconFor(section)} />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{item.title}</div>
                        <div className="truncate text-xs text-white/60">{item.subtitle || section}</div>
                      </div>
                      <span className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-white/60">
                        {section}
                      </span>
                    </Wrapper>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  return (
    <div className="mx-auto mt-6 max-w-4xl px-4 pb-16">
      <form className="mt-6" onSubmit={handleSubmit}>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Artists, tracks, playlists..."
            className="h-12 w-full rounded-2xl border border-white/10 bg-white/5 pl-10 pr-3 text-base text-white placeholder:text-white/40 focus-visible:border-white/30 focus-visible:outline-none"
          />
        </div>
      </form>

      {suggestLoading ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sugestije iz baze...
        </div>
      ) : null}

      {query.trim() && suggestions.length ? (
        <div className="mt-3 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {suggestions.map((item) => (
            <button
              key={`${item.type}-${item.id}-suggest`}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-white hover:bg-white/10"
              onClick={() => {
                if (item.type === "artist") {
                  navigate(`/artist/${item.id}`);
                  return;
                }
                setQuery(item.title);
                void runSearch(item.title);
              }}
            >
              <Thumb imageUrl={item.imageUrl} fallback={iconFor(item.type)} />
              <div className="min-w-0">
                <div className="truncate font-semibold">{item.title}</div>
                <div className="truncate text-xs text-white/60">{item.subtitle || item.type}</div>
              </div>
              <span className="ml-auto rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.1em] text-white/60">
                {item.type}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {renderResults()}
    </div>
  );
}
