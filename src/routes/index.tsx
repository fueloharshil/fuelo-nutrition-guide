import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { Search, MapPin, List as ListIcon, Map as MapIcon, Bookmark, Info, X, User, SlidersHorizontal } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Restaurant, MenuItem } from "@/lib/fuelo-types";
import { StatusBadge } from "@/components/StatusBadge";
import { useFilters } from "@/components/FiltersProvider";
import { FilterSheet } from "@/components/FilterSheet";
import {
  activeFilterCount,
  anyFilterActive,
  dishMatchesFilters,
  hasDishLevelFilters,
} from "@/lib/filters";
import { restaurantCuisines, CUISINE_TAGS } from "@/lib/cuisines";
import { CUISINE_IMAGES, cuisineImageUrl } from "@/lib/cuisineImages";
import { computeBadge } from "@/lib/discoverBadges";
import { BottomNav } from "@/components/BottomNav";

const DiscoverMap = lazy(() => import("@/components/DiscoverMap"));
import { WaitlistBanner } from "@/components/WaitlistBanner";

type DiscoverItem = Pick<
  MenuItem,
  | "id"
  | "restaurant_id"
  | "name"
  | "calories_min"
  | "calories_max"
  | "protein_min"
  | "protein_max"
  | "dietary_tags"
  | "is_verified"
>;

const DEFAULT_CENTER: [number, number] = [51.5462, -0.0755]; // Dalston

const discoverQuery = queryOptions({
  queryKey: ["discover"],
  queryFn: async () => {
    const [rests, items] = await Promise.all([
      supabase.from("restaurants").select("*").order("name"),
      supabase
        .from("menu_items")
        .select(
          "id,restaurant_id,name,calories_min,calories_max,protein_min,protein_max,dietary_tags,is_verified",
        ),
    ]);
    if (rests.error) throw rests.error;
    if (items.error) throw items.error;
    return {
      restaurants: (rests.data ?? []) as Restaurant[],
      items: (items.data ?? []) as DiscoverItem[],
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
  const { filters, patch } = useFilters();
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
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

  // Distinct cuisine tags actually present across restaurants, for the
  // "Trending near you" tiles. Deduped by exact tag (the taxonomy is canonical,
  // so tiles can never duplicate), ordered by how many restaurants carry each
  // tag (most common first), then by the taxonomy's own order.
  const trendingCuisines = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of data.restaurants) {
      for (const tag of restaurantCuisines(r)) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    const orderIndex = (tag: string) => {
      const i = (CUISINE_TAGS as readonly string[]).indexOf(tag);
      return i === -1 ? CUISINE_TAGS.length : i;
    };
    return [...counts.keys()].sort((a, b) => {
      const byCount = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
      return byCount !== 0 ? byCount : orderIndex(a) - orderIndex(b);
    });
  }, [data.restaurants]);

  // Restaurants that have at least one dish matching ALL active dish-level
  // filters (max calories, min protein, dietary). null = no dish-level filter.
  const matchingRestaurantIds = useMemo(() => {
    if (!hasDishLevelFilters(filters)) return null;
    const ids = new Set<string>();
    for (const it of data.items) {
      if (!ids.has(it.restaurant_id) && dishMatchesFilters(it, filters)) {
        ids.add(it.restaurant_id);
      }
    }
    return ids;
  }, [data.items, filters]);

  // Restaurants with at least one restaurant-verified dish, for the "Verified"
  // map-pin badge (distinct from the restaurant-level `verified` flag).
  const verifiedRestaurantIds = useMemo(() => {
    const ids = new Set<string>();
    for (const it of data.items) {
      if (it.is_verified) ids.add(it.restaurant_id);
    }
    return ids;
  }, [data.items]);

  // One badge per restaurant for its map pin: Verified > New > Top Rated.
  const badges = useMemo(() => {
    const map: Record<string, ReturnType<typeof computeBadge>> = {};
    for (const r of data.restaurants) {
      map[r.id] = computeBadge(r, verifiedRestaurantIds.has(r.id));
    }
    return map;
  }, [data.restaurants, verifiedRestaurantIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dishHits = q
      ? new Set(
          data.items.filter((i) => i.name.toLowerCase().includes(q)).map((i) => i.restaurant_id),
        )
      : null;
    return data.restaurants.filter((r) => {
      const tags = restaurantCuisines(r);
      if (filters.cuisine && !tags.includes(filters.cuisine)) return false;
      if (matchingRestaurantIds && !matchingRestaurantIds.has(r.id)) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        tags.some((c) => c.toLowerCase().includes(q)) ||
        (r.cuisine ?? "").toLowerCase().includes(q) ||
        dishHits!.has(r.id)
      );
    });
  }, [query, filters, data, matchingRestaurantIds]);

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <WaitlistBanner />

      <TrendingRow
        cuisines={trendingCuisines}
        active={filters.cuisine}
        onSelect={(c) => patch({ cuisine: filters.cuisine === c ? null : c })}
        onClear={() => patch({ cuisine: null })}
      />

      <div className="px-4 pt-3 pb-2 sm:px-6">
        <SearchBar value={query} onChange={setQuery} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <ViewToggle view={view} onChange={setView} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "spot" : "spots"}
            </span>
            <FilterButton count={activeFilterCount(filters)} onClick={() => setFiltersOpen(true)} />
          </div>
        </div>
        <ActiveFiltersRow />
      </div>


      {view === "map" ? (
        <div className="relative w-full h-[calc(100vh-180px)] min-h-[400px]">
          {hydrated ? (
            <Suspense fallback={<MapSkeleton />}>
              <DiscoverMap
                restaurants={filtered}
                center={center}
                userLocation={userLocation}
                onSelect={setSelected}
                activeId={selected?.id}
                badges={badges}
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

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        resultCount={filtered.length}
      />

      <BottomNav active="discover" />
    </main>
  );
}

function Header() {
  return (
    <header className="px-4 pt-6 pb-1 sm:px-6 flex items-start justify-between gap-3">
      <Link to="/" className="flex flex-col min-w-0">
        <img
          src="/fuelo-wordmark.svg"
          alt="Fuelo"
          className="h-14 w-auto"
          width={178}
          height={70}
        />
        <span className="mt-1 text-[11px] uppercase tracking-widest text-muted-foreground">
          Discover More, Digest Smarter.
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
  lebanese: "🥙",
  persian: "🍢",
  mediterranean: "🫒",
  greek: "🫒",
  brunch: "🍳",
  breakfast: "🍳",
  "live-fire grill": "🔥",
  "live fire": "🔥",
  grill: "🔥",
  bbq: "🔥",
  bakery: "🥐",
  dessert: "🍰",
  italian: "🍝",
  pizza: "🍕",
  spanish: "🥘",
  portuguese: "🐟",
  french: "🥖",
  british: "🥧",
  european: "🧀",
  sushi: "🍣",
  japanese: "🍣",
  korean: "🍲",
  ramen: "🍜",
  thai: "🌶️",
  vietnamese: "🍜",
  malaysian: "🍛",
  filipino: "🍢",
  indian: "🍛",
  pakistani: "🍛",
  bangladeshi: "🍛",
  nepalese: "🥟",
  "sri lankan": "🍛",
  chinese: "🥟",
  mexican: "🌮",
  caribbean: "🍹",
  nigerian: "🍲",
  african: "🍲",
  ethiopian: "🍲",
  vegan: "🥗",
  vegetarian: "🥗",
  healthy: "🥗",
  halal: "🥙",
  seafood: "🦐",
  burger: "🍔",
  chicken: "🍗",
  american: "🍔",
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
          {cuisines.map((c) => (
            <li key={c} className="flex-none">
              <CuisineTile
                cuisine={c}
                active={active?.toLowerCase() === c.toLowerCase()}
                onSelect={() => onSelect(c)}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const TILE_W = 144;
const TILE_H = 112;

function CuisineTile({
  cuisine,
  active,
  onSelect,
}: {
  cuisine: string;
  active: boolean;
  onSelect: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = CUISINE_IMAGES[cuisine];
  const showImage = !!imageUrl && !imgFailed;

  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`group relative flex h-[112px] w-[144px] flex-col justify-end overflow-hidden rounded-2xl text-left shadow-[var(--shadow-card)] transition-shadow duration-200 hover:shadow-[var(--shadow-float)] ${
        active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
      }`}
    >
      {/* Base layer: on-brand green gradient. Always present, so a missing or
          failed photo degrades to this instead of a blank tile. */}
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, oklch(0.72 0.14 148) 0%, oklch(0.42 0.11 152) 100%)",
        }}
      />
      {showImage && (
        <img
          src={cuisineImageUrl(imageUrl, TILE_W * 2, TILE_H * 2)}
          alt=""
          loading="lazy"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-110 group-active:scale-110"
        />
      )}
      {/* Dark gradient overlay so the white label stays readable over any photo. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />

      <span className="absolute left-3 top-3 z-10 text-lg leading-none drop-shadow" aria-hidden>
        {cuisineEmoji(cuisine)}
      </span>
      <span className="relative z-10 px-3 pb-3 text-sm font-bold leading-tight tracking-tight text-white drop-shadow-sm">
        {cuisine}
      </span>
    </button>
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

function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  const active = count > 0;
  return (
    <button
      onClick={onClick}
      aria-label="Filters"
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition active:scale-[0.98] ${
        active
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span className="hidden sm:inline">Filters</span>
      {active && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary-foreground px-1 text-[11px] font-bold text-primary">
          {count}
        </span>
      )}
    </button>
  );
}

function ActiveFiltersRow() {
  const { filters, patch, toggleDietary, reset } = useFilters();
  if (!anyFilterActive(filters)) return null;

  const chips: { key: string; label: string; onRemove: () => void }[] = [];
  if (filters.maxCalories != null)
    chips.push({
      key: "cal",
      label: `≤ ${filters.maxCalories} kcal`,
      onRemove: () => patch({ maxCalories: null }),
    });
  if (filters.minProtein != null)
    chips.push({
      key: "pro",
      label: `≥ ${filters.minProtein} g protein`,
      onRemove: () => patch({ minProtein: null }),
    });
  for (const d of filters.dietary)
    chips.push({ key: `diet-${d}`, label: d, onRemove: () => toggleDietary(d) });
  if (filters.cuisine != null)
    chips.push({ key: "cuisine", label: filters.cuisine, onRemove: () => patch({ cuisine: null }) });

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <button
          key={c.key}
          onClick={c.onRemove}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-accent-foreground transition hover:opacity-80"
        >
          {c.label}
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        onClick={reset}
        className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
      >
        Reset filters
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
