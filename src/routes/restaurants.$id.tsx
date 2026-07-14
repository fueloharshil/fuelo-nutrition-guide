import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, MapPin, Info, SlidersHorizontal, Check } from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Restaurant } from "@/lib/fuelo-types";
import { NutritionChips } from "@/components/NutritionChips";
import { StatusBadge } from "@/components/StatusBadge";
import { ConfidenceRing } from "@/components/ConfidenceRing";
import { useSaved } from "@/components/SavedProvider";
import { ClaimRestaurantCard } from "@/components/ClaimRestaurantCard";
import { useFilters } from "@/components/FiltersProvider";
import { dishMatchesFilters, hasDishLevelFilters } from "@/lib/filters";
import { groupByCategory, type SortKey } from "@/lib/menuGrouping";

const restaurantQuery = (id: string) =>
  queryOptions({
    queryKey: ["restaurant", id],
    queryFn: async () => {
      const [r, items] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", id).maybeSingle(),
        supabase
          .from("menu_items")
          .select("*")
          .eq("restaurant_id", id)
          .order("category", { ascending: true, nullsFirst: false })
          .order("name"),
      ]);
      if (r.error) throw r.error;
      if (items.error) throw items.error;
      return {
        restaurant: r.data as Restaurant | null,
        items: (items.data ?? []) as MenuItem[],
      };
    },
  });

export const Route = createFileRoute("/restaurants/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(restaurantQuery(params.id)),
  component: RestaurantPage,
  errorComponent: ({ error }) => (
    <div className="p-8 text-sm text-muted-foreground">Couldn't load: {error.message}</div>
  ),
  notFoundComponent: () => <div className="p-8">Restaurant not found.</div>,
});

function RestaurantPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(restaurantQuery(id));
  const router = useRouter();
  const { isSaved, toggle } = useSaved();
  const { filters } = useFilters();
  const filtersOn = hasDishLevelFilters(filters);
  // Hide dishes an owner marked "not on our menu anymore" (is_active = false).
  // Pre-migration the column is absent (undefined), so nothing is hidden.
  const activeItems = data.items.filter((it) => it.is_active !== false);
  const matchCount = filtersOn
    ? activeItems.filter((it) => dishMatchesFilters(it, filters)).length
    : 0;

  const r = data.restaurant;
  if (!r) {
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">Restaurant not found.</p>
        <Link to="/" className="text-primary underline text-sm mt-2 inline-block">
          Back to discover
        </Link>
      </div>
    );
  }

  const saved = isSaved(r.id);
  const [sort, setSort] = useState<SortKey>("none");
  const grouped = groupByCategory(activeItems, sort);



  return (
    <main className="min-h-screen pb-24">
      <div className="px-4 pt-5 sm:px-6 flex items-center justify-between">
        <button
          onClick={() => router.history.back()}
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button
          onClick={() => toggle(r.id)}
          className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent transition"
        >
          {saved ? (
            <>
              <BookmarkCheck className="h-4 w-4 text-primary" /> Saved
            </>
          ) : (
            <>
              <Bookmark className="h-4 w-4" /> Save
            </>
          )}
        </button>
      </div>

      <header className="px-4 pt-6 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">{r.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{r.cuisine}</p>
            <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {r.area}
            </p>
          </div>
          {r.verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
              Verified Nutrition
            </span>
          )}
        </div>
      </header>

      {filtersOn && (
        <div className="px-4 sm:px-6 mt-6">
          <div className="flex w-full items-start gap-2 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm">
            <SlidersHorizontal className="mt-0.5 h-4 w-4 flex-none text-primary" />
            <span>
              {matchCount > 0 ? (
                <>
                  Highlighting{" "}
                  <strong className="font-semibold text-primary">{matchCount}</strong>{" "}
                  {matchCount === 1 ? "dish that matches" : "dishes that match"} your filters.
                </>
              ) : (
                <>No dishes here match your current filters.</>
              )}
            </span>
          </div>
        </div>
      )}

      <div className="px-4 sm:px-6 mt-6 flex items-center justify-between gap-3">
        <label className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
          Sort dishes
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded-full bg-secondary px-3 h-9 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="none">Menu order</option>
          <option value="protein">Highest protein</option>
          <option value="calories">Lowest calorie</option>
          <option value="ratio">Best protein-to-calorie balance</option>
        </select>
      </div>

      <div className="px-4 sm:px-6 mt-6 space-y-8">

        {grouped.length === 0 && (
          <div className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            Menu coming soon. Once items are imported, they'll appear here with full nutrition
            ranges.
          </div>
        )}
        {grouped.map(([category, items]) => (
          <section key={category ?? "misc"}>
            <h2 className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-3">
              {category ?? "Menu"}
            </h2>
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <DishCard
                    item={item}
                    restaurantVerified={r.verified}
                    highlight={filtersOn && dishMatchesFilters(item, filters)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <ClaimRestaurantCard defaultName={r.name} />

      <p className="px-6 py-6 mt-4 text-[11px] text-muted-foreground inline-flex items-start gap-2 max-w-2xl">
        <Info className="h-3.5 w-3.5 mt-[1px] flex-none" />
        Nutrition is AI-estimated for discovery, not a guarantee — check with the restaurant for
        allergens.
      </p>
    </main>
  );
}

function DishCard({
  item,
  restaurantVerified,
  highlight = false,
}: {
  item: MenuItem;
  restaurantVerified: boolean;
  highlight?: boolean;
}) {
  const verified = item.is_verified || restaurantVerified;
  const price =
    item.price_gbp != null ? `£${Number(item.price_gbp).toFixed(2).replace(/\.00$/, "")}` : null;

  return (
    <article
      className={`rounded-2xl p-4 shadow-[var(--shadow-card)] transition ${
        highlight ? "bg-accent/40 ring-2 ring-primary/50" : "bg-card"
      }`}
    >
      {highlight && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Check className="h-3 w-3" />
          Matches your filters
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-base font-bold tracking-tight leading-snug">{item.name}</h3>
        {price && <span className="text-sm font-semibold tabular-nums">{price}</span>}
      </div>
      {item.description && (
        <p className="mt-1 text-sm text-muted-foreground leading-snug">{item.description}</p>
      )}
      <div className="mt-3">
        <NutritionChips item={item} />
      </div>
      {item.dietary_tags && item.dietary_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.dietary_tags.map((tag) => (
            <span
              key={tag}
              className="text-[11px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium"
            >
              {tag}
              {item.tag_source === "AI-estimated" && (
                <span className="ml-1 text-muted-foreground font-normal">· est.</span>
              )}
            </span>
          ))}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between">
        <StatusBadge verified={verified} />
        <ConfidenceRing confidence={item.confidence} verified={verified} />
      </div>
    </article>
  );
}


