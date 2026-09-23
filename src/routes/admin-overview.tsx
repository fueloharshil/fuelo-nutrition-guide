import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { dbPending } from "@/lib/supabasePending";
import type { MenuItem, Restaurant, RestaurantOwner } from "@/lib/fuelo-types";
import { fetchAllProfileViewsThisMonth } from "@/lib/analytics";
import { useOwnerAuth, ADMIN_EMAIL } from "@/hooks/useOwnerAuth";

export const Route = createFileRoute("/admin-overview")({
  component: AdminOverviewPage,
  head: () => ({ meta: [{ title: "Restaurant overview · FUELO" }] }),
});

function AdminOverviewPage() {
  const { email, loading, isAdmin, signOut } = useOwnerAuth();

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Restaurant overview</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Outreach progress across every restaurant, at a glance.
            </p>
          </div>
          {email && (
            <button
              onClick={() => signOut()}
              className="inline-flex flex-none items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent transition"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !email ? (
          <OverviewLogin />
        ) : !isAdmin ? (
          <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold tracking-tight">Not authorised</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{email}</span>, which
              isn't an admin account.
            </p>
          </div>
        ) : (
          <OverviewTable />
        )}
      </div>
    </main>
  );
}

function OverviewLogin() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/admin-overview` : undefined;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    if (err) {
      setStatus("error");
      setError(err.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="text-base font-bold tracking-tight text-primary">Check your email</p>
        <p className="mt-2 text-sm text-muted-foreground">Open the login link on this device.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 grid gap-2 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold tracking-tight">Admin login</h2>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="mt-1 h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
      >
        {status === "loading" ? "Sending…" : "Send login link"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </form>
  );
}

type ClaimStatus = "Unclaimed" | "Claimed" | "Verified owner";

type OverviewRow = {
  id: string;
  name: string;
  totalDishes: number;
  verifiedPct: number;
  profileViewsThisMonth: number;
  leadCount: number;
  claimStatus: ClaimStatus;
};

// restaurant_leads has no restaurant_id FK (it's a free-text claim form —
// see restaurant_leads in CLAUDE.md), so leads are matched to a restaurant by
// a case/whitespace-insensitive name compare. Good enough for outreach
// tracking; a lead with a typo'd or blank restaurant name just won't match.
const normalizeName = (s: string) => s.trim().toLowerCase();

async function fetchOverview(): Promise<OverviewRow[]> {
  const [rRes, itemsRes, ownersRes, leadsRes, viewsThisMonth] = await Promise.all([
    supabase.from("restaurants").select("id,name").order("name"),
    supabase.from("menu_items").select("restaurant_id,is_active,is_verified"),
    dbPending.from("restaurant_owners").select("email,restaurant_id"),
    supabase.from("restaurant_leads").select("restaurant_name"),
    fetchAllProfileViewsThisMonth(),
  ]);
  if (rRes.error) throw rRes.error;
  if (itemsRes.error) throw itemsRes.error;
  if (ownersRes.error) throw ownersRes.error;
  if (leadsRes.error) throw leadsRes.error;

  const restaurants = (rRes.data ?? []) as Pick<Restaurant, "id" | "name">[];
  const items = (itemsRes.data ?? []) as Pick<MenuItem, "restaurant_id" | "is_active" | "is_verified">[];
  const owners = (ownersRes.data ?? []) as RestaurantOwner[];
  const leads = (leadsRes.data ?? []) as { restaurant_name: string | null }[];

  const ownedRestaurantIds = new Set(
    owners.filter((o) => o.restaurant_id).map((o) => o.restaurant_id as string),
  );

  const leadCounts = new Map<string, number>();
  for (const lead of leads) {
    if (!lead.restaurant_name) continue;
    const key = normalizeName(lead.restaurant_name);
    leadCounts.set(key, (leadCounts.get(key) ?? 0) + 1);
  }

  return restaurants.map((r) => {
    const restaurantItems = items.filter((it) => it.restaurant_id === r.id);
    const active = restaurantItems.filter((it) => it.is_active !== false);
    const totalDishes = active.length;
    const verifiedCount = active.filter((it) => it.is_verified).length;
    const verifiedPct = totalDishes > 0 ? Math.round((verifiedCount / totalDishes) * 100) : 0;
    const claimStatus: ClaimStatus = !ownedRestaurantIds.has(r.id)
      ? "Unclaimed"
      : verifiedCount > 0
        ? "Verified owner"
        : "Claimed";

    return {
      id: r.id,
      name: r.name,
      totalDishes,
      verifiedPct,
      profileViewsThisMonth: viewsThisMonth.get(r.id) ?? 0,
      leadCount: leadCounts.get(normalizeName(r.name)) ?? 0,
      claimStatus,
    };
  });
}

function OverviewTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: fetchOverview,
  });

  if (isLoading) {
    return (
      <div className="mt-10 flex justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-8 rounded-2xl bg-card p-6 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
        Couldn't load the overview: {(error as Error).message}
      </div>
    );
  }

  const rows = data ?? [];
  const counts = {
    unclaimed: rows.filter((r) => r.claimStatus === "Unclaimed").length,
    claimed: rows.filter((r) => r.claimStatus === "Claimed").length,
    verified: rows.filter((r) => r.claimStatus === "Verified owner").length,
  };

  return (
    <div className="mt-6">
      <p className="text-sm text-muted-foreground">
        {rows.length} {rows.length === 1 ? "restaurant" : "restaurants"} · {counts.unclaimed} unclaimed
        · {counts.claimed} claimed · {counts.verified} verified owner
        {counts.verified === 1 ? "" : "s"}
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl bg-card shadow-[var(--shadow-card)]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              <th className="px-4 py-3">Restaurant</th>
              <th className="px-4 py-3 text-right">Dishes</th>
              <th className="px-4 py-3 text-right">% verified</th>
              <th className="px-4 py-3 text-right">Views (30d)</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3">Claim status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.totalDishes}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.verifiedPct}%</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.profileViewsThisMonth}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.leadCount}</td>
                <td className="px-4 py-3">
                  <ClaimStatusBadge status={r.claimStatus} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No restaurants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Link
        to="/admin"
        className="mt-4 inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        Approve &amp; link owners →
      </Link>
    </div>
  );
}

function ClaimStatusBadge({ status }: { status: ClaimStatus }) {
  const styles: Record<ClaimStatus, string> = {
    Unclaimed: "bg-secondary text-muted-foreground",
    Claimed: "bg-accent text-accent-foreground",
    "Verified owner": "bg-primary/15 text-primary",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${styles[status]}`}
    >
      {status}
    </span>
  );
}
