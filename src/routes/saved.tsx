import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import type { Restaurant } from "@/lib/fuelo-types";
import { useSaved } from "@/components/SavedProvider";
import { BottomNav } from "@/components/BottomNav";

const allRestaurantsQuery = queryOptions({
  queryKey: ["restaurants-all"],
  queryFn: async () => {
    const { data, error } = await supabase.from("restaurants").select("*").order("name");
    if (error) throw error;
    return (data ?? []) as Restaurant[];
  },
});

export const Route = createFileRoute("/saved")({
  loader: ({ context }) => context.queryClient.ensureQueryData(allRestaurantsQuery),
  component: SavedPage,
  errorComponent: ({ error }) => <div className="p-8">Couldn't load: {error.message}</div>,
  notFoundComponent: () => <div className="p-8">Not found.</div>,
});

function SavedPage() {
  const { data: restaurants } = useSuspenseQuery(allRestaurantsQuery);
  const { saved } = useSaved();
  const items = restaurants.filter((r) => saved.includes(r.id));

  return (
    <main className="min-h-screen pb-24">
      <div className="px-4 pt-5 sm:px-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Saved</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your favourite independent restaurants.
        </p>
      </div>
      <div className="px-4 sm:px-6 mt-6">
        {items.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
            You haven't saved any restaurants yet. Tap the bookmark on a restaurant page to save
            it here.
          </div>
        ) : (
          <ul className="grid gap-3">
            {items.map((r) => (
              <li key={r.id}>
                <Link
                  to="/restaurants/$id"
                  params={{ id: r.id }}
                  className="block bg-card rounded-2xl p-4 shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-float)] transition"
                >
                  <h3 className="text-lg font-bold tracking-tight">{r.name}</h3>
                  <p className="text-sm text-muted-foreground">{r.cuisine}</p>
                  <p className="mt-1 text-xs text-muted-foreground inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {r.area}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav active="saved" />
    </main>
  );
}
