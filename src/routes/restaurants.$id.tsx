import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Bookmark, BookmarkCheck, MapPin, Info } from "lucide-react";


import { supabase } from "@/integrations/supabase/client";
import type { MenuItem, Restaurant } from "@/lib/fuelo-types";
import { NutritionChips } from "@/components/NutritionChips";
import { StatusBadge } from "@/components/StatusBadge";
import { useSaved } from "@/components/SavedProvider";

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
  const grouped = groupByCategory(data.items);

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

      <div className="px-4 sm:px-6 mt-8 space-y-8">
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
                  <DishCard item={item} restaurantVerified={r.verified} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="px-6 py-6 mt-4 text-[11px] text-muted-foreground inline-flex items-start gap-2 max-w-2xl">
        <Info className="h-3.5 w-3.5 mt-[1px] flex-none" />
        Nutrition shown is AI-estimated for discovery, not a guarantee. Dietary tags marked as
        estimated aren't confirmed by the restaurant — always check for allergens.
      </p>
    </main>
  );
}

function DishCard({ item, restaurantVerified }: { item: MenuItem; restaurantVerified: boolean }) {
  const verified = item.is_verified || restaurantVerified;
  const price =
    item.price_gbp != null ? `£${Number(item.price_gbp).toFixed(2).replace(/\.00$/, "")}` : null;

  return (
    <article className="bg-card rounded-2xl p-4 shadow-[var(--shadow-card)]">
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
        {item.confidence != null && !verified && (
          <span className="text-[10px] text-muted-foreground">
            confidence {Math.round(Number(item.confidence) * 100)}%
          </span>
        )}
      </div>
    </article>
  );
}

const CATEGORY_ORDER = [
  "Snacks",
  "Cold Meze",
  "Hot Meze",
  "Small Plates",
  "Cold Small Plates",
  "Hot Small Plates",
  "Sarnies",
  "Wraps",
  "Large Plates",
  "Chops & Cuts",
  "Mixed Meze",
  "Brunch",
  "Breakfast",
  "Sides",
  "Vegetarian",
  "Feasting Menu",
  "Sweet Things",
  "Dessert",
  "Housemade Softs",
  "Softs",
  "Hot Drinks",
  "Cocktails",
  "Beer & Cider",
  "Wine",
  "Spirits",
  "Digestifs",
  "Fortified",
];

function groupByCategory(items: MenuItem[]): [string | null, MenuItem[]][] {
  const map = new Map<string | null, MenuItem[]>();
  for (const it of items) {
    const key = it.category || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  const orderIndex = (key: string | null) => {
    if (key == null) return CATEGORY_ORDER.length + 1;
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === key.toLowerCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return Array.from(map.entries()).sort(([a], [b]) => {
    const ai = orderIndex(a);
    const bi = orderIndex(b);
    if (ai !== bi) return ai - bi;
    const as = a ?? "";
    const bs = b ?? "";
    return as.localeCompare(bs);
  });
}
