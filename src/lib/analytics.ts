import { dbPending } from "@/lib/supabasePending";
import type { RestaurantEvent } from "@/lib/fuelo-types";

// restaurant_events isn't in the generated Supabase types yet (new table —
// see migration 20260716090000_restaurant_events), so this goes through the
// same typed escape hatch as restaurant_owners/menu_categories until
// types.ts is regenerated.
//
// Logging is fire-and-forget: a failed analytics ping (table not migrated
// yet, network hiccup, ad blocker) must never break the page the visitor is
// actually trying to use, so every write here only warns on failure.

function logEvents(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  void dbPending
    .from("restaurant_events")
    .insert(rows)
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) console.warn("[analytics] event log failed:", error.message);
    });
}

export function logProfileView(restaurantId: string) {
  logEvents([{ restaurant_id: restaurantId, event_type: "profile_view" }]);
}

export function logMenuItemView(restaurantId: string, menuItemId: string) {
  logEvents([
    { restaurant_id: restaurantId, event_type: "menu_item_view", menu_item_id: menuItemId },
  ]);
}

/** One search/filter-apply action that matched one or more restaurants,
 *  each via one or more filter criteria. All rows share a single search_id
 *  so the dashboard can count distinct searches vs. per-filter matches. */
export function logSearchMatches(matches: { restaurantId: string; filterLabels: string[] }[]) {
  const searchId = crypto.randomUUID();
  const rows = matches.flatMap(({ restaurantId, filterLabels }) =>
    filterLabels.map((filterType) => ({
      restaurant_id: restaurantId,
      event_type: "search_match",
      filter_type: filterType,
      search_id: searchId,
    })),
  );
  logEvents(rows);
}

export type RestaurantAnalytics = {
  profileViews: { thisWeek: number; lastWeek: number; thisMonth: number; lastMonth: number };
  topDishes: { menuItemId: string; views: number }[];
  searchesThisWeek: number;
  filterBreakdown: { label: string; count: number }[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Fetches the last 60 days of events for one restaurant and reduces them to
 *  the owner dashboard's stats client-side — enough history to cover "this
 *  week vs last week" and "this month vs last month" without a server-side
 *  aggregation query, matching how the rest of the app fetches raw rows and
 *  computes over them in the client. Returns null (rather than throwing) if
 *  the table isn't reachable yet, so the dashboard can degrade gracefully. */
export async function fetchRestaurantAnalytics(
  restaurantId: string,
): Promise<RestaurantAnalytics | null> {
  const since = new Date(Date.now() - 60 * DAY_MS).toISOString();
  const { data, error } = await dbPending
    .from("restaurant_events")
    .select("event_type,menu_item_id,filter_type,search_id,created_at")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", since);
  if (error) {
    console.warn("[analytics] restaurant_events unavailable:", error.message);
    return null;
  }

  const events = (data ?? []) as Pick<
    RestaurantEvent,
    "event_type" | "menu_item_id" | "filter_type" | "search_id" | "created_at"
  >[];
  const now = Date.now();
  const ageDays = (iso: string) => (now - new Date(iso).getTime()) / DAY_MS;
  const inLast = (iso: string, days: number) => ageDays(iso) < days;
  const inPriorWindow = (iso: string, from: number, to: number) => {
    const age = ageDays(iso);
    return age >= from && age < to;
  };

  const profileViewEvents = events.filter((e) => e.event_type === "profile_view");
  const profileViews = {
    thisWeek: profileViewEvents.filter((e) => inLast(e.created_at, 7)).length,
    lastWeek: profileViewEvents.filter((e) => inPriorWindow(e.created_at, 7, 14)).length,
    thisMonth: profileViewEvents.filter((e) => inLast(e.created_at, 30)).length,
    lastMonth: profileViewEvents.filter((e) => inPriorWindow(e.created_at, 30, 60)).length,
  };

  const dishCounts = new Map<string, number>();
  for (const e of events) {
    if (e.event_type === "menu_item_view" && e.menu_item_id) {
      dishCounts.set(e.menu_item_id, (dishCounts.get(e.menu_item_id) ?? 0) + 1);
    }
  }
  const topDishes = [...dishCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([menuItemId, views]) => ({ menuItemId, views }));

  const searchEventsThisWeek = events.filter(
    (e) => e.event_type === "search_match" && inLast(e.created_at, 7),
  );
  const searchesThisWeek = new Set(searchEventsThisWeek.map((e) => e.search_id)).size;

  const filterCounts = new Map<string, number>();
  for (const e of searchEventsThisWeek) {
    if (e.filter_type) filterCounts.set(e.filter_type, (filterCounts.get(e.filter_type) ?? 0) + 1);
  }
  const filterBreakdown = [...filterCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count }));

  return { profileViews, topDishes, searchesThisWeek, filterBreakdown };
}

/** Profile-view counts for every restaurant over the last 30 days, in one
 *  query — used by the admin overview page rather than calling
 *  fetchRestaurantAnalytics() once per restaurant. Relies on the admin RLS
 *  policy (any other signed-in visitor can only read their own restaurant's
 *  events, so this returns an empty map for them). Degrades to an empty map
 *  rather than throwing, same as the rest of this file. */
export async function fetchAllProfileViewsThisMonth(): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data, error } = await dbPending
    .from("restaurant_events")
    .select("restaurant_id")
    .eq("event_type", "profile_view")
    .gte("created_at", since);
  if (error) {
    console.warn("[analytics] restaurant_events unavailable:", error.message);
    return new Map();
  }
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { restaurant_id: string }[]) {
    counts.set(row.restaurant_id, (counts.get(row.restaurant_id) ?? 0) + 1);
  }
  return counts;
}

export type Trend = { direction: "up" | "down" | "flat" | "new"; pct: number | null };

/** Compares `cur` (this period) to `prev` (the one before it) for a small
 *  up/down trend indicator. Returns null when there's nothing to compare
 *  (both periods empty) rather than a misleading 0%/Infinity%. */
export function computeTrend(cur: number, prev: number): Trend | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return { direction: "new", pct: null };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { direction: "flat", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct };
}
