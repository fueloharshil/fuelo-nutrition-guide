import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Search, MapPin, List as ListIcon, Map as MapIcon, Bookmark, Info, X, Settings, SlidersHorizontal, Target, ChevronRight, Footprints, Bike, Car, Trash2, LogIn } from "lucide-react";

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
  matchingFilterLabels,
  travelLabel,
  type TravelMode,
} from "@/lib/filters";
import { logSearchMatches } from "@/lib/analytics";
import { fetchTravelTimes, haversineMeters, type TravelTimeResult } from "@/lib/travelTimes";
import { LocationPicker } from "@/components/LocationPicker";
import type { GeocodeResult } from "@/lib/geocoding";
import { useLocationContext } from "@/components/LocationProvider";
import { useNearbyWalkTime } from "@/hooks/useNearbyWalkTime";
import { restaurantCuisines, CUISINE_TAGS } from "@/lib/cuisines";
import { CUISINE_IMAGES, cuisineImageUrl } from "@/lib/cuisineImages";
import { computeBadge } from "@/lib/discoverBadges";
import { BottomNav } from "@/components/BottomNav";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { useProfile, PROFILE_KEY } from "@/components/ProfileProvider";
import { dishFitsGoal } from "@/lib/profile";
import { SAVED_KEY } from "@/components/SavedProvider";
import { WAITLIST_DISMISS_KEY, WAITLIST_DONE_KEY } from "@/components/WaitlistBanner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  errorComponent: ({ reset }) => {
    const router = useRouter();
    return <ErrorState onRetry={() => { router.invalidate(); reset(); }} />;
  },
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function Discover() {
  const { data } = useSuspenseQuery(discoverQuery);
  const { filters, patch, reset: resetFilters } = useFilters();
  const { profile, hasGoal } = useProfile();
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [selected, setSelected] = useState<Restaurant | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Shared app-wide (LocationProvider, mounted in __root.tsx) so a location
  // set here — live GPS or a manually searched place via LocationPicker —
  // carries over to other pages too, e.g. the restaurant page's "X min
  // walk" badge. See effectiveLocation there for why it's memoized in the
  // provider rather than recomputed as a fresh array on every render here.
  const { gpsLocation, setGpsLocation, manualLocation, setManualLocation, effectiveLocation } =
    useLocationContext();
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const manualLocationRef = useRef(manualLocation);
  manualLocationRef.current = manualLocation;

  useEffect(() => {
    setHydrated(true);
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    let recenteredOnce = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setGpsLocation(loc);
        if (!recenteredOnce && !manualLocationRef.current) {
          recenteredOnce = true;
          setCenter(loc);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 8000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectManualLocation(result: GeocodeResult) {
    setManualLocation({ lat: result.lat, lng: result.lng, label: result.label });
    setCenter([result.lat, result.lng]);
  }

  function useCurrentLocation() {
    setManualLocation(null);
    if (gpsLocation) setCenter(gpsLocation);
  }

  // Real walking/cycling/driving times from Mapbox's Matrix API (see
  // src/lib/travelTimes.ts), fetched once per travel mode / meaningful move
  // — not on every GPS tick, which would spam the API for no benefit while
  // standing still. Fetched for every restaurant with coordinates regardless
  // of other active filters, so toggling cuisine/calories/etc. never needs a
  // refetch; only the "Within X min" threshold (applied below, no refetch)
  // narrows results further.
  const [travelTimes, setTravelTimes] = useState<Map<string, TravelTimeResult> | null>(null);
  const [travelLoading, setTravelLoading] = useState(false);
  const lastTravelFetchRef = useRef<{ lat: number; lng: number; mode: string } | null>(null);

  useEffect(() => {
    if (!filters.travel || !effectiveLocation) {
      setTravelTimes(null);
      lastTravelFetchRef.current = null;
      return;
    }
    const origin = { lat: effectiveLocation[0], lng: effectiveLocation[1] };
    const last = lastTravelFetchRef.current;
    const moved = !last || haversineMeters(last, origin) > 100;
    const modeChanged = last?.mode !== filters.travel.mode;
    if (!moved && !modeChanged) return;

    let cancelled = false;
    lastTravelFetchRef.current = { ...origin, mode: filters.travel.mode };
    setTravelLoading(true);
    const destinations = data.restaurants
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => ({ id: r.id, lat: r.latitude as number, lng: r.longitude as number }));
    fetchTravelTimes(origin, destinations, filters.travel.mode).then((result) => {
      if (cancelled) return;
      setTravelLoading(false);
      if (result) setTravelTimes(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.travel?.mode, effectiveLocation, data.restaurants]);

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

  // Restaurants with at least one dish fitting the user's goal, for the
  // "Fits your goal" tag on restaurant cards. A filter against the profile's
  // target — not a running total — so it's the same every time, independent
  // of anything logged elsewhere.
  const goalFitRestaurantIds = useMemo(() => {
    if (!hasGoal) return null;
    const ids = new Set<string>();
    for (const it of data.items) {
      if (!ids.has(it.restaurant_id) && dishFitsGoal(it, profile)) {
        ids.add(it.restaurant_id);
      }
    }
    return ids;
  }, [data.items, hasGoal, profile]);

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
      // Only narrows results once travel times have actually loaded — before
      // that, ignore the threshold rather than flashing to an empty list.
      if (filters.travel?.maxMinutes != null && travelTimes) {
        const t = travelTimes.get(r.id);
        if (!t || t.minutes > filters.travel.maxMinutes) return false;
      }
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        tags.some((c) => c.toLowerCase().includes(q)) ||
        (r.cuisine ?? "").toLowerCase().includes(q) ||
        dishHits!.has(r.id)
      );
    });
  }, [query, filters, data, matchingRestaurantIds, travelTimes]);

  // Owner-facing analytics: when the filter sheet closes with active
  // dish-level filters, log a search-visibility event for every restaurant
  // that currently matches, tagged with which specific criteria matched
  // (see matchingFilterLabels — independent per-criterion, not the AND used
  // to decide who's shown). Closing without any dish-level filter active
  // (or with none matching) logs nothing.
  const clearSearchAndFilters = () => {
    setQuery("");
    resetFilters();
  };

  const closeFilters = () => {
    setFiltersOpen(false);
    if (!matchingRestaurantIds || matchingRestaurantIds.size === 0) return;
    logSearchMatches(
      [...matchingRestaurantIds].map((restaurantId) => ({
        restaurantId,
        filterLabels: matchingFilterLabels(
          data.items.filter((it) => it.restaurant_id === restaurantId),
          filters,
        ),
      })),
    );
  };

  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <WaitlistBanner />
      {!hasGoal && (
        <Link
          to="/profile"
          className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-3 rounded-2xl px-4 py-3.5 shadow-[var(--shadow-card)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)]"
          style={{
            background:
              "linear-gradient(135deg, oklch(0.94 0.06 148 / 0.9) 0%, oklch(0.9 0.07 140 / 0.9) 100%)",
          }}
        >
          <span className="inline-flex items-center gap-3 text-sm font-semibold text-accent-foreground">
            <span className="inline-flex h-9 w-9 flex-none items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[var(--shadow-card)]">
              <Target className="h-4 w-4" />
            </span>
            Set a goal to see dishes that fit it
          </span>
          <ChevronRight className="h-4 w-4 flex-none text-accent-foreground/70" />
        </Link>
      )}

      <TrendingRow
        cuisines={trendingCuisines}
        active={filters.cuisine}
        onSelect={(c) => patch({ cuisine: filters.cuisine === c ? null : c })}
        onClear={() => patch({ cuisine: null })}
      />

      <div className="px-4 pt-3 pb-2 sm:px-6">
        <SearchBar value={query} onChange={setQuery} />
        <LocationBar label={manualLocation?.label ?? null} onClick={() => setLocationPickerOpen(true)} />
        <div className="mt-3 flex items-center justify-between gap-3">
          <ViewToggle view={view} onChange={setView} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {travelLoading
                ? "Getting travel times…"
                : `${filtered.length} ${filtered.length === 1 ? "spot" : "spots"}`}
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
                userLocation={effectiveLocation}
                onSelect={setSelected}
                activeId={selected?.id}
                badges={badges}
              />
            </Suspense>
          ) : (
            <MapSkeleton />
          )}
          {!travelLoading && filtered.length === 0 && (
            <div className="absolute inset-x-3 top-3 z-[400]">
              <NoResultsState onReset={clearSearchAndFilters} />
            </div>
          )}
          {selected && (
            <RestaurantPreview
              restaurant={selected}
              onClose={() => setSelected(null)}
              fitsGoal={goalFitRestaurantIds?.has(selected.id) ?? false}
              travel={
                filters.travel
                  ? { mode: filters.travel.mode, minutes: travelTimes?.get(selected.id)?.minutes ?? null }
                  : null
              }
            />
          )}
        </div>
      ) : (
        <div className="flex-1 px-4 pb-24 sm:px-6">
          <ul className="grid gap-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <RestaurantCard
                  restaurant={r}
                  fitsGoal={goalFitRestaurantIds?.has(r.id) ?? false}
                  travel={
                    filters.travel
                      ? { mode: filters.travel.mode, minutes: travelTimes?.get(r.id)?.minutes ?? null }
                      : null
                  }
                />
              </li>
            ))}
            {!travelLoading && filtered.length === 0 && (
              <li className="pt-4">
                <NoResultsState onReset={clearSearchAndFilters} />
              </li>
            )}
          </ul>
        </div>
      )}

      <Disclaimer />

      <FilterSheet
        open={filtersOpen}
        onClose={closeFilters}
        resultCount={filtered.length}
        hasLocation={!!effectiveLocation}
      />

      <LocationPicker
        open={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        onSelect={selectManualLocation}
        onUseCurrentLocation={useCurrentLocation}
        hasGps={!!gpsLocation}
      />

      <BottomNav active="discover" />
    </main>
  );
}

function Header() {
  return (
    <header className="relative overflow-hidden px-4 pt-6 pb-5 sm:px-6">
      <div className="hero-wash" aria-hidden />
      <div className="relative z-10 flex items-start justify-between gap-3">
        <Link to="/" className="flex flex-col items-start min-w-0">
          <img
            src="/fuelo-wordmark.svg"
            alt="Fuelo"
            className="h-14 w-auto -ml-1.5"
            width={178}
            height={70}
          />
          <span className="mt-2.5 text-[11px] uppercase tracking-widest text-muted-foreground">
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
          <SettingsMenu />
        </div>
      </div>
    </header>
  );
}

// Fuelo has no consumer accounts (see ProfileProvider — goal/dietary
// preference and Saved are local-only, no sign-up/login). This is a
// lightweight settings menu over what actually exists today, not an
// account menu: edit your local profile, and a "Clear my data" reset as
// the closest local equivalent to "sign out" — there's nothing to log out
// of. Revisit if/when Fuelo gets real accounts (e.g. once there's an
// ordering flow that needs saved addresses).
function SettingsMenu() {
  function clearLocalData() {
    if (typeof window === "undefined") return;
    const confirmed = window.confirm(
      "Clear your saved goal, dietary preference, and saved restaurants from this device? This can't be undone.",
    );
    if (!confirmed) return;
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(SAVED_KEY);
    localStorage.removeItem(WAITLIST_DISMISS_KEY);
    localStorage.removeItem(WAITLIST_DONE_KEY);
    window.location.reload();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Settings"
          className="inline-flex items-center justify-center h-9 w-9 rounded-full bg-secondary hover:bg-accent transition"
        >
          <Settings className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Settings</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer">
            <Target className="h-4 w-4" /> Edit goal &amp; diet
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/saved" className="cursor-pointer">
            <Bookmark className="h-4 w-4" /> Saved restaurants
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={clearLocalData}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <Trash2 className="h-4 w-4" /> Clear my data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/login" className="cursor-pointer">
            <LogIn className="h-4 w-4" /> Restaurant / admin sign in
          </Link>
        </DropdownMenuItem>
        <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
          No account needed above — everything is saved on this device only.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
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
        <h2 className="font-display text-[11px] uppercase tracking-widest text-muted-foreground font-bold">
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
      className={`group relative flex h-[112px] w-[144px] flex-col justify-end overflow-hidden rounded-2xl text-left shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] active:translate-y-0 active:scale-[0.98] ${
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
      <span className="font-display relative z-10 px-3 pb-3 text-sm font-bold leading-tight tracking-tight text-white drop-shadow-sm">
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

function LocationBar({ label, onClick }: { label: string | null; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full px-1 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
    >
      <MapPin className="h-3.5 w-3.5 flex-none text-primary" />
      <span className="truncate">{label ?? "Near you"}</span>
      <span className="flex-none text-primary underline-offset-2">Change</span>
    </button>
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
      className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition duration-200 active:scale-[0.98] ${
        active
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-card)]"
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
  if (filters.travel != null)
    chips.push({
      key: "travel",
      label: travelLabel(filters.travel.mode, filters.travel.maxMinutes),
      onRemove: () => patch({ travel: null }),
    });

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

function NoResultsState({ onReset }: { onReset: () => void }) {
  return (
    <EmptyState
      icon={Search}
      title="No dishes match right now"
      description="Try adjusting your filters."
      action={
        <button
          onClick={onReset}
          className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
        >
          Reset filters
        </button>
      }
    />
  );
}

type TravelInfo = { mode: TravelMode; minutes: number | null };

function RestaurantCard({
  restaurant,
  fitsGoal = false,
  travel = null,
}: {
  restaurant: Restaurant;
  fitsGoal?: boolean;
  travel?: TravelInfo | null;
}) {
  return (
    <Link
      to="/restaurants/$id"
      params={{ id: restaurant.id }}
      className="block bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-float)] active:translate-y-0 active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-bold tracking-tight truncate">{restaurant.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{restaurant.cuisine}</p>
          <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {restaurant.area}
          </p>
        </div>
        {restaurant.verified && <StatusBadge verified />}
      </div>
      {(fitsGoal || travel) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fitsGoal && <GoalFitTag />}
          {travel && <TravelTag mode={travel.mode} minutes={travel.minutes} />}
        </div>
      )}
    </Link>
  );
}

function GoalFitTag({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
    >
      <Target className="h-3 w-3" />
      Fits your goal
    </span>
  );
}

function TravelTag({ mode, minutes, className = "" }: { mode: TravelMode; minutes: number | null; className?: string }) {
  const Icon = mode === "walking" ? Footprints : mode === "cycling" ? Bike : Car;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary ${className}`}
    >
      <Icon className="h-3 w-3" />
      {travelLabel(mode, minutes)}
    </span>
  );
}

function RestaurantPreview({
  restaurant,
  onClose,
  fitsGoal = false,
  travel = null,
}: {
  restaurant: Restaurant;
  onClose: () => void;
  fitsGoal?: boolean;
  travel?: TravelInfo | null;
}) {
  // Always shows a walk time when it's genuinely nearby, regardless of
  // whether the travel-time filter is on — tapping a pin should tell you
  // "3 min walk" without needing to dig into Filters first. Only one
  // restaurant is ever previewed at a time, so this single-destination
  // fetch is cheap (unlike the list view's many cards — see RestaurantCard,
  // which still only shows travel info when the filter's bulk fetch has it).
  const walkMinutes = useNearbyWalkTime(restaurant.id, restaurant.latitude, restaurant.longitude);
  // Avoid showing the same "X min walk" twice if the travel-time filter is
  // also set to Walking.
  const showWalkBadge = walkMinutes != null && travel?.mode !== "walking";

  return (
    <div className="absolute inset-x-3 bottom-3 z-[400] rounded-2xl bg-card p-4 shadow-[var(--shadow-float)]">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 rounded-full p-1 hover:bg-muted"
      >
        <X className="h-4 w-4" />
      </button>
      <h3 className="font-display text-lg font-bold tracking-tight pr-8">{restaurant.name}</h3>
      <p className="text-sm text-muted-foreground">{restaurant.cuisine}</p>
      <p className="text-xs text-muted-foreground mt-0.5 inline-flex items-center gap-1">
        <MapPin className="h-3 w-3" /> {restaurant.area}
      </p>
      {(fitsGoal || travel || showWalkBadge) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {fitsGoal && <GoalFitTag />}
          {travel && <TravelTag mode={travel.mode} minutes={travel.minutes} />}
          {showWalkBadge && <TravelTag mode="walking" minutes={walkMinutes} />}
        </div>
      )}
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
