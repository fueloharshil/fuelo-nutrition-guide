import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Search, MapPin, List as ListIcon, Map as MapIcon, Bookmark, Info, X, User } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Restaurant, MenuItem } from "@/lib/fuelo-types";
import { StatusBadge } from "@/components/StatusBadge";

const DiscoverMap = lazy(() => import("@/components/DiscoverMap"));
import { WaitlistBanner } from "@/components/WaitlistBanner";

const DEFAULT_CENTER: [number, number] = [51.5462, -0.0755]; // Dalston

const discoverQuery = queryOptions({
  queryKey: ["discover"],
  queryFn: async () => {
    const [rests, items] = await Promise.all([
      supabase.from("restaurants").select("*").order("name"),
      supabase.from("menu_items").select("id,restaurant_id,name"),
    ]);
    if (rests.error) throw rests.error;
    if (items.error) throw items.error;
    return {
      restaurants: (rests.data ?? []) as Restaurant[],
      items: (items.data ?? []) as Pick<MenuItem, "id" | "restaurant_id" | "name">[],
    };
  },
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(discoverQuery),
  component: Discover,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function Discover() {
  const { data } = useSuspenseQuery(discoverQuery);
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let recenteredOnce = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setUserLocation(loc);
        if (!recenteredOnce) {
          recenteredOnce = true;
          setCenter(loc);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const cuisines = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    for (const r of data.restaurants) {
      const c = (r.cuisine ?? "").trim();
      if (!c) continue;
      const key = c.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(c);
    }
    return list.sort();
  }, [data.restaurants]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dishHits = q
      ? new Set(
          data.items.filter((i) => i.name.toLowerCase().includes(q)).map((i) => i.restaurant_id),
        )
      : null;
    return data.restaurants.filter((r) => {
      if (cuisine && (r.cuisine ?? "").toLowerCase() !== cuisine.toLowerCase()) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        (r.cuisine ?? "").toLowerCase().includes(q) ||
        dishHits!.has(r.id)
      );
    });
  }, [query, cuisine, data]);

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <WaitlistBanner />

      <TrendingRow
        cuisines={cuisines}
        active={cuisine}
        onSelect={(c) => setCuisine((prev) => (prev === c ? null : c))}
        onClear={() => setCuisine(null)}
      />

      <div className="px-4 pt-3 pb-2 sm:px-6">
        <SearchBar value={query} onChange={setQuery} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <ViewToggle view={view} onChange={setView} />
          <span className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "spot" : "spots"}
          </span>
        </div>
      </div>


      {view === "map" ? (
        <div className="relative flex-1 min-h-[calc(100vh-180px)] h-[calc(100vh-180px)] min-h-[400px]">
          {hydrated ? (
            <Suspense fallback={<MapSkeleton />}>
              <DiscoverMap
                restaurants={filtered}
                center={center}
                userLocation={userLocation}
                onSelect={setSelected}
                activeId={selected?.id}
              />
            </Suspense>
          ) : (
            <MapSkeleton />
          )}
          {selected && (
            <RestaurantPreview restaurant={selected} onClose={() => setSelected(null)} />
          )}
        </div>
      ) : (
        <div className="flex-1 px-4 pb-24 sm:px-6">
          <ul className="grid gap-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <RestaurantCard restaurant={r} />
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-sm text-muted-foreground py-8 text-center">
                No matches. Try a different dish or cuisine.
              </li>
            )}
          </ul>
        </div>
      )}

      <Disclaimer />
    </main>
  );
}

function Header() {
  return (
    <header className="px-4 pt-6 pb-1 sm:px-6 flex items-start justify-between gap-3">
      <Link to="/" className="flex flex-col min-w-0">
        <span className="text-2xl font-extrabold tracking-tight text-primary leading-none">
          FUELO
        </span>
        <span className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          Enjoy eating out, fuelled by healthy decisions
        </span>
      </Link>
      <div className="flex items-center gap-2 flex-none">
        <Link
          to="/saved"
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent transition"
        >
          <Bookmark className="h-4 w-4" />
          <span className="hidden sm:inline">Saved</span>
        </Link>
        <Link
          to="/profile"
          aria-label="Your profile"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-secondary hover:bg-accent transition"
        >
          <User className="h-4 w-4" />
        </Link>
      </div>
    </header>
  );
}

const CUISINE_EMOJI: Record<string, string> = {
  "middle eastern": "🥙",
  "middle east": "🥙",
  turkish: "🥙",
  mediterranean: "🫒",
  brunch: "🍳",
  breakfast: "🍳",
  "live-fire grill": "🔥",
  "live fire": "🔥",
  grill: "🔥",
  bbq: "🔥",
  bakery: "🥐",
  italian: "🍝",
  pizza: "🍕",
  sushi: "🍣",
  japanese: "🍣",
  ramen: "🍜",
  thai: "🌶️",
  indian: "🍛",
  chinese: "🥟",
  mexican: "🌮",
  vegan: "🥗",
  vegetarian: "🥗",
  seafood: "🦐",
  burger: "🍔",
  american: "🍔",
  french: "🥖",
  cafe: "☕",
  coffee: "☕",
};

function cuisineEmoji(c: string): string {
  const key = c.toLowerCase();
  if (CUISINE_EMOJI[key]) return CUISINE_EMOJI[key];
  for (const [k, v] of Object.entries(CUISINE_EMOJI)) {
    if (key.includes(k)) return v;
  }
  return "🍽️";
}

function TrendingRow({
  cuisines,
  active,
  onSelect,
  onClear,
}: {
  cuisines: string[];
  active: string | null;
  onSelect: (c: string) => void;
  onClear: () => void;
}) {
  if (cuisines.length === 0) return null;
  return (
    <section className="px-4 sm:px-6 pt-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          Trending near you
        </h2>
        {active && (
          <button
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full bg-secondary hover:bg-accent px-2.5 py-1 text-[11px] font-medium transition"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto scrollbar-none">
        <ul className="flex gap-3 pb-1">
          {cuisines.map((c) => {
            const isActive = active?.toLowerCase() === c.toLowerCase();
            return (
              <li key={c} className="flex-none">
                <button
                  onClick={() => onSelect(c)}
                  className={`relative flex flex-col justify-between w-[140px] h-[92px] rounded-2xl p-3 text-left shadow-[var(--shadow-card)] overflow-hidden transition active:scale-[0.98] ${
                    isActive
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                      : "hover:shadow-[var(--shadow-float)]"
                  }`}
                  style={{
                    background:
                      "linear-gradient(135deg, oklch(0.72 0.14 148) 0%, oklch(0.42 0.11 152) 100%)",
                  }}
                >
                  <span className="text-2xl leading-none" aria-hidden>
                    {cuisineEmoji(c)}
                  </span>
                  <span className="text-white font-bold text-sm leading-tight tracking-tight drop-shadow-sm">
                    {c}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}


function SearchBar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search restaurants or dishes"
        className="w-full h-12 rounded-2xl bg-card pl-11 pr-4 text-[15px] shadow-[var(--shadow-card)] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
      />
    </div>
  );
}

function ViewToggle({ view, onChange }: { view: "map" | "list"; onChange: (v: "map" | "list") => void }) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-1 text-sm font-medium">
      <button
        onClick={() => onChange("map")}
        className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full transition ${
          view === "map" ? "bg-card shadow-[var(--shadow-card)] text-foreground" : "text-muted-foreground"
        }`}
      >
        <MapIcon className="h-4 w-4" /> Map
      </button>
      <button
        onClick={() => onChange("list")}
        className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-full transition ${
          view === "list" ? "bg-card shadow-[var(--shadow-card)] text-foreground" : "text-muted-foreground"
        }`}
      >
        <ListIcon className="h-4 w-4" /> List
      </button>
    </div>
  );
}

function MapSkeleton() {
  return <div className="h-full w-full bg-muted animate-pulse" />;
}

function RestaurantCard({ restaurant }: { restaurant: Restaurant }) {
  return (
    <Link
      to="/restaurants/$id"
      params={{ id: restaurant.id }}
      className="block bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-float)] transition active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold tracking-tight truncate">{restaurant.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{restaurant.cuisine}</p>
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {restaurant.area}
          </p>
        </div>
        {restaurant.verified && <StatusBadge verified />}
      </div>
    </Link>
  );
}

function RestaurantPreview({
  restaurant,
  onClose,
}: {
  restaurant: Restaurant;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-x-3 bottom-3 z-[400] rounded-2xl bg-card p-4 shadow-[var(--shadow-float)]">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="text-lg font-bold tracking-tight pr-8">{restaurant.name}</h3>
      <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>
      <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
        <MapPin className="h-3 w-3" /> {restaurant.area}
      </p>
      <Link
        to="/restaurants/$id"
        params={{ id: restaurant.id }}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-primary text-primary-foreground h-11 text-sm font-semibold hover:opacity-95 transition"
      >
        View menu
      </Link>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="px-6 py-4 text-[11px] text-muted-foreground inline-flex items-start gap-2 max-w-2xl">
      <Info className="h-3.5 w-3.5 mt-[1px] flex-none" />
      Nutrition shown is AI-estimated for discovery, not a guarantee. Always check with the
      restaurant for allergens.
    </p>
  );
}
