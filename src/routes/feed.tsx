import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { MapPin, Info } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Restaurant } from "@/lib/fuelo-types";
import { midpoint } from "@/lib/filters";
import { NutritionChips } from "@/components/NutritionChips";
import { StatusBadge } from "@/components/StatusBadge";
import { BottomNav } from "@/components/BottomNav";

const feedQuery = queryOptions({
  queryKey: ["feed"],
  queryFn: async () => {
    const [rests, items] = await Promise.all([
      supabase.from("restaurants").select("*").order("name"),
      supabase.from("menu_items").select("*").order("created_at", { ascending: false }),
    ]);
    if (rests.error) throw rests.error;
    if (items.error) throw items.error;
    return {
      restaurants: (rests.data ?? []) as Restaurant[],
      items: (items.data ?? []) as MenuItem[],
    };
  },
});

export const Route = createFileRoute("/feed")({
  loader: ({ context }) => context.queryClient.ensureQueryData(feedQuery),
  component: Feed,
  head: () => ({
    meta: [
      { title: "Feed · FUELO" },
      { name: "description", content: "Trending spots, newly verified dishes, and high protein picks near you." },
    ],
  }),
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load: {error.message}</div>
  ),
});

function proteinCalorieRatio(item: MenuItem): number | null {
  const p = midpoint(item.protein_min, item.protein_max);
  const c = midpoint(item.calories_min, item.calories_max);
  if (p == null || c == null || c === 0) return null;
  return p / c;
}

function Feed() {
  const { data } = useSuspenseQuery(feedQuery);

  const restaurantById = useMemo(() => {
    const map = new Map<string, Restaurant>();
    for (const r of data.restaurants) map.set(r.id, r);
    return map;
  }, [data.restaurants]);

  // Exclude dishes hidden by an owner (is_active = false). Pre-migration the
  // column is absent (undefined), so nothing is excluded.
  const activeItems = useMemo(
    () => data.items.filter((i) => i.is_active !== false),
    [data.items],
  );

  const newlyVerified = useMemo(
    () => activeItems.filter((i) => i.is_verified).slice(0, 10),
    [activeItems],
  );

  const highProteinPicks = useMemo(() => {
    return [...activeItems]
      .filter((i) => proteinCalorieRatio(i) != null)
      .sort((a, b) => {
        if (a.is_verified !== b.is_verified) return a.is_verified ? -1 : 1;
        return proteinCalorieRatio(b)! - proteinCalorieRatio(a)!;
      })
      .slice(0, 10);
  }, [activeItems]);

  return (
    <main className="min-h-screen pb-24">
      <header className="px-4 pt-6 pb-1 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight">Feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trending spots and standout dishes, pulled from what's on the menu.
        </p>
      </header>

      <FeedSection title="Trending near you">
        <ul className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
          {data.restaurants.map((r) => (
            <li key={r.id} className="flex-none">
              <Link
                to="/restaurants/$id"
                params={{ id: r.id }}
                className="block w-[180px] rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-float)] active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold tracking-tight leading-snug">{r.name}</h3>
                  {r.verified && <StatusBadge verified />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{r.cuisine}</p>
                <p className="mt-1 text-[11px] text-muted-foreground inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {r.area}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </FeedSection>

      <FeedSection title="Newly verified">
        {newlyVerified.length === 0 ? (
          <EmptyNote text="No restaurant-verified dishes yet — check back soon." />
        ) : (
          <DishRow items={newlyVerified} restaurantById={restaurantById} />
        )}
      </FeedSection>

      <FeedSection title="High protein picks nearby">
        {highProteinPicks.length === 0 ? (
          <EmptyNote text="Not enough nutrition data yet to rank dishes." />
        ) : (
          <DishRow items={highProteinPicks} restaurantById={restaurantById} />
        )}
      </FeedSection>

      <p className="px-6 py-4 text-[11px] text-muted-foreground inline-flex items-start gap-2 max-w-2xl">
        <Info className="h-3.5 w-3.5 mt-[1px] flex-none" />
        Nutrition shown is AI-estimated for discovery, not a guarantee. Always check with the
        restaurant for allergens.
      </p>

      <BottomNav active="feed" />
    </main>
  );
}

function FeedSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="pt-6">
      <h2 className="px-4 sm:px-6 text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function DishRow({
  items,
  restaurantById,
}: {
  items: MenuItem[];
  restaurantById: Map<string, Restaurant>;
}) {
  return (
    <ul className="flex gap-3 overflow-x-auto scrollbar-none pb-1 -mx-4 px-4 sm:-mx-6 sm:px-6">
      {items.map((item) => {
        const restaurant = restaurantById.get(item.restaurant_id);
        return (
          <li key={item.id} className="flex-none">
            <Link
              to="/restaurants/$id"
              params={{ id: item.restaurant_id }}
              className="block w-[220px] rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-float)] active:scale-[0.99]"
            >
              <h3 className="text-sm font-bold tracking-tight leading-snug truncate">
                {item.name}
              </h3>
              {restaurant && (
                <p className="mt-0.5 text-xs text-muted-foreground truncate">{restaurant.name}</p>
              )}
              <div className="mt-2">
                <NutritionChips item={item} />
              </div>
              <div className="mt-2">
                <StatusBadge verified={item.is_verified} />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <div className="mx-4 sm:mx-6 rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
      {text}
    </div>
  );
}
