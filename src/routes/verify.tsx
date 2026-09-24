import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Mail,
  Check,
  CheckCircle2,
  SlidersHorizontal,
  EyeOff,
  LogOut,
  Loader2,
  Eye,
  Search,
  TrendingUp,
  TrendingDown,
  X,
  ShoppingBag,
  CalendarCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { dbPending } from "@/lib/supabasePending";
import type { MenuItem, Restaurant, RestaurantOwner, CookingFat, IngredientDetail } from "@/lib/fuelo-types";
import { formatRange, COOKING_FAT_LABEL } from "@/lib/fuelo-types";
import { groupByCategory, type CategoryTypeMap } from "@/lib/menuGrouping";
import { fetchCategoryTypeMap } from "@/lib/categoryTypes";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";
import { fetchRestaurantAnalytics, computeTrend, type RestaurantAnalytics, type Trend } from "@/lib/analytics";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/verify")({
  component: VerifyPage,
  head: () => ({
    meta: [
      { title: "Verify your menu · FUELO" },
      { name: "description", content: "Restaurant owners: verify your menu's nutrition on Fuelo." },
    ],
  }),
});

function VerifyPage() {
  const { email, loading, signOut } = useOwnerAuth();

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">For restaurants</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Verify your menu's ingredients &amp; nutrition.
            </p>
          </div>
          {email && (
            <button
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-accent transition"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          )}
        </div>

        {loading ? (
          <LoadingBlock />
        ) : email ? (
          <OwnerDashboard email={email} />
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}

function LoadingBlock() {
  return (
    <div className="mt-10 flex items-center justify-center text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/verify` : undefined;
    const { error: err } = await supabase.auth.signInWithOtp({
      email: value,
      options: { emailRedirectTo: redirectTo },
    });
    if (err) {
      setStatus("error");
      setError(err.message || "Couldn't send the link. Try again.");
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="text-base font-bold tracking-tight text-primary inline-flex items-center gap-2">
          <Mail className="h-5 w-5" /> Check your email
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a login link to{" "}
          <span className="font-medium text-foreground">{email.trim().toLowerCase()}</span>. Open it
          on this device to continue.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold tracking-tight">Restaurant login</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Enter the email you claimed with and we'll send you a login link.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@restaurant.com"
          maxLength={255}
          className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-12 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          {status === "loading" ? "Sending…" : "Send me a login link"}
        </button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>
    </div>
  );
}

type OwnerData = {
  owner: RestaurantOwner | null;
  restaurant: Restaurant | null;
  items: MenuItem[];
  categoryTypeMap: CategoryTypeMap;
};

function OwnerDashboard({ email }: { email: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["owner-dashboard", email.toLowerCase()];

  const { data, isLoading, error } = useQuery<OwnerData>({
    queryKey,
    queryFn: async () => {
      const ownerRes = await dbPending
        .from("restaurant_owners")
        .select("*")
        .ilike("email", email)
        .maybeSingle();
      if (ownerRes.error) throw ownerRes.error;
      const owner = (ownerRes.data ?? null) as RestaurantOwner | null;

      if (!owner || !owner.restaurant_id) {
        return { owner, restaurant: null, items: [], categoryTypeMap: new Map() };
      }

      const [rRes, itemsRes, categoryTypeMap] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", owner.restaurant_id).maybeSingle(),
        // Not ordered by category — see the matching comment in
        // restaurants.$id.tsx; groupByCategory does the bucket sort.
        supabase.from("menu_items").select("*").eq("restaurant_id", owner.restaurant_id),
        fetchCategoryTypeMap(),
      ]);
      if (rRes.error) throw rRes.error;
      if (itemsRes.error) throw itemsRes.error;
      return {
        owner,
        restaurant: (rRes.data ?? null) as Restaurant | null,
        items: (itemsRes.data ?? []) as MenuItem[],
        categoryTypeMap,
      };
    },
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey });

  if (isLoading) return <LoadingBlock />;
  if (error) {
    return (
      <StateCard title="Something went wrong">
        {(error as Error).message}. If your restaurant was just approved, try signing out and back
        in.
      </StateCard>
    );
  }

  if (!data?.owner) {
    return (
      <StateCard title="No claim found for this email">
        We couldn't find a restaurant claim under{" "}
        <span className="font-medium text-foreground">{email}</span>. Submit the "Own this
        restaurant?" form on your restaurant's page first.
      </StateCard>
    );
  }

  if (!data.owner.restaurant_id || !data.restaurant) {
    return (
      <StateCard title="Your claim is pending approval">
        Thanks for claiming! We're reviewing it and will link your restaurant shortly. Check back
        soon.
      </StateCard>
    );
  }

  const activeItems = data.items.filter((it) => it.is_active !== false);
  const verifiedCount = activeItems.filter((it) => it.is_verified).length;
  const total = activeItems.length;
  const pct = total > 0 ? Math.round((verifiedCount / total) * 100) : 0;
  const grouped = groupByCategory(activeItems, "none", data.categoryTypeMap);

  return (
    <div className="mt-6">
      {verifiedCount < total && (
        <VerifyProgressBanner restaurantId={data.restaurant.id} remaining={total - verifiedCount} />
      )}

      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight truncate">{data.restaurant.name}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {verifiedCount} of {total} {total === 1 ? "dish" : "dishes"} verified
            </p>
          </div>
          <span className="flex-none text-3xl font-extrabold tabular-nums text-primary">{pct}%</span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        {verifiedCount === total && total > 0 && (
          <p className="mt-2 text-sm font-semibold text-primary inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" /> All done — your whole menu is verified.
          </p>
        )}
      </div>

      <AnalyticsSection restaurantId={data.restaurant.id} items={data.items} />

      <LinkCard
        restaurantId={data.restaurant.id}
        field="external_order_url"
        value={data.restaurant.external_order_url ?? null}
        icon={<ShoppingBag className="h-4 w-4 text-primary" />}
        title="Order online link"
        description="Optional — add a link to wherever you'd like customers to order from (your website, Deliveroo, Uber Eats, Just Eat, etc.)"
        placeholder="e.g. deliveroo.co.uk/menu/your-restaurant"
        onSaved={refresh}
      />

      <LinkCard
        restaurantId={data.restaurant.id}
        field="booking_url"
        value={data.restaurant.booking_url ?? null}
        icon={<CalendarCheck className="h-4 w-4 text-primary" />}
        title="Book a table link"
        description="Optional — add a link to wherever customers can reserve a table (OpenTable, SevenRooms, Resy, or your own site)."
        placeholder="e.g. opentable.co.uk/your-restaurant"
        onSaved={refresh}
      />

      <div className="mt-6 space-y-8">
        {grouped.map(([category, items]) => (
          <section key={category ?? "menu"}>
            <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              {category ?? "Menu"}
            </h3>
            <ul className="grid gap-3">
              {items.map((item) => (
                <li key={item.id}>
                  <DishRow item={item} onChanged={refresh} />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

// Nudges an owner with unverified dishes toward finishing their menu.
// Dismissing it only hides it for this browser tab (sessionStorage, not
// localStorage) — it comes back on the next visit for as long as
// verification is still incomplete, so it isn't permanently silence-able.
const VERIFY_BANNER_DISMISS_PREFIX = "fuelo:verify-banner-dismissed:";

function VerifyProgressBanner({
  restaurantId,
  remaining,
}: {
  restaurantId: string;
  remaining: number;
}) {
  const dismissKey = `${VERIFY_BANNER_DISMISS_PREFIX}${restaurantId}`;
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(dismissKey, "1");
    } catch {}
    setDismissed(true);
  }

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 shadow-[var(--shadow-card)]">
      <p className="text-sm text-foreground">
        <span className="font-semibold">Verified restaurants get more visibility in search</span> —
        verify your remaining {remaining} {remaining === 1 ? "dish" : "dishes"} to complete your
        profile.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="flex-none rounded-full p-1 text-muted-foreground hover:bg-primary/10"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

// Owner-facing analytics — profile views, most-viewed dishes, and search
// visibility. Fetches its own data (rather than being passed it from
// OwnerDashboard's query) so a failure here — most likely the
// restaurant_events migration not being live yet — degrades to a quiet
// message instead of breaking the verify list above it.
function AnalyticsSection({ restaurantId, items }: { restaurantId: string; items: MenuItem[] }) {
  const { data: analytics, isLoading } = useQuery<RestaurantAnalytics | null>({
    queryKey: ["owner-analytics", restaurantId],
    queryFn: () => fetchRestaurantAnalytics(restaurantId),
  });

  if (isLoading) {
    return <div className="mt-4 h-28 animate-pulse rounded-2xl bg-card" />;
  }
  if (!analytics) {
    return (
      <p className="mt-4 text-xs text-muted-foreground">
        Analytics will show up here once this update is fully live — check back soon.
      </p>
    );
  }

  // Distinct from `!analytics` above (the table isn't reachable yet): this
  // table IS reachable, there just aren't any events logged for this
  // restaurant yet — a brand-new or not-yet-visited listing.
  const hasActivity =
    analytics.profileViews.thisMonth > 0 ||
    analytics.searchesThisWeek > 0 ||
    analytics.topDishes.length > 0;
  if (!hasActivity) {
    return (
      <EmptyState
        icon={Eye}
        title="No activity yet"
        description="Once customers start viewing your page, visits and popular dishes will show up here."
        className="mt-4"
      />
    );
  }

  const monthTrend = computeTrend(analytics.profileViews.thisMonth, analytics.profileViews.lastMonth);
  const dishName = (id: string) => items.find((it) => it.id === id)?.name ?? "Deleted dish";

  return (
    <div className="mt-4 grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Eye className="h-3.5 w-3.5" />}
          label="Profile views"
          value={analytics.profileViews.thisWeek}
          sub="this week"
          trend={computeTrend(analytics.profileViews.thisWeek, analytics.profileViews.lastWeek)}
          footnote={`${analytics.profileViews.thisMonth} this month${
            monthTrend ? ` (${trendText(monthTrend)})` : ""
          }`}
        />
        <StatCard
          icon={<Search className="h-3.5 w-3.5" />}
          label="Search visibility"
          value={analytics.searchesThisWeek}
          sub={analytics.searchesThisWeek === 1 ? "search this week" : "searches this week"}
          trend={null}
          footnote={
            analytics.filterBreakdown.length > 0 ? (
              <span className="flex flex-wrap gap-x-2 gap-y-0.5">
                {analytics.filterBreakdown.slice(0, 3).map((f) => (
                  <span key={f.label} className="whitespace-nowrap">
                    {f.label} · {f.count}
                  </span>
                ))}
              </span>
            ) : (
              "No filtered searches yet"
            )
          }
        />
      </div>

      {analytics.topDishes.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Most viewed dishes
          </h3>
          <ol className="mt-2 grid gap-1.5">
            {analytics.topDishes.map((d, i) => (
              <li key={d.menuItemId} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground tabular-nums">{i + 1}.</span>{" "}
                  {dishName(d.menuItemId)}
                </span>
                <span className="flex-none font-semibold tabular-nums text-primary">
                  {d.views} {d.views === 1 ? "view" : "views"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function trendText(t: Trend): string {
  if (t.direction === "new") return "new";
  if (t.direction === "flat") return "no change";
  return `${t.pct! > 0 ? "+" : ""}${t.pct}%`;
}

function StatCard({
  icon,
  label,
  value,
  sub,
  trend,
  footnote,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  trend: Trend | null;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-card)]">
      <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {icon} {label}
      </p>
      <p className="mt-1.5 text-2xl font-extrabold tabular-nums tracking-tight">{value}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
        <span>{sub}</span>
        {trend && <TrendBadge trend={trend} />}
      </div>
      {footnote && <div className="mt-2 text-[11px] text-muted-foreground">{footnote}</div>}
    </div>
  );
}

function TrendBadge({ trend }: { trend: Trend }) {
  if (trend.direction === "new") {
    return <span className="font-semibold text-primary">New</span>;
  }
  if (trend.direction === "flat") {
    return <span>No change</span>;
  }
  const up = trend.direction === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold ${up ? "text-primary" : "text-destructive"}`}
    >
      <Icon className="h-3 w-3" /> {Math.abs(trend.pct ?? 0)}%
    </span>
  );
}

// Lets the owner set one of the restaurant page's link buttons (Order
// Online / Book a Table). Column-level grant on
// restaurants(phone, external_order_url, booking_url) — see migrations
// 20260717090000_restaurant_contact_fields and
// 20260924160500_restaurant_booking_url — so this update can only ever
// touch that one field on the owner's own restaurant row.
function LinkCard({
  restaurantId,
  field,
  value,
  icon,
  title,
  description,
  placeholder,
  onSaved,
}: {
  restaurantId: string;
  field: "external_order_url" | "booking_url";
  value: string | null;
  icon: React.ReactNode;
  title: string;
  description: string;
  placeholder: string;
  onSaved: () => void;
}) {
  const [url, setUrl] = useState(value ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setSaving(true);
    let trimmed = url.trim();
    // Owners naturally type "google.com" or "deliveroo.co.uk/…" without a
    // scheme — normalize instead of rejecting it, so this never blocks on
    // something like the browser's native URL validation.
    if (trimmed && !/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }
    setUrl(trimmed);
    const { error } = await dbPending
      .from("restaurants")
      .update({ [field]: trimmed || null })
      .eq("id", restaurantId);
    setSaving(false);
    if (error) {
      setErr(error.message || "Couldn't save. Try again.");
      return;
    }
    setMsg("Saved.");
    onSaved();
  }

  return (
    <div className="mt-6 rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="inline-flex items-center gap-1.5 text-base font-bold tracking-tight">
        {icon} {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={placeholder}
          className="h-12 flex-1 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-12 flex-none items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save
        </button>
      </form>
      {msg && <p className="mt-2 text-xs font-medium text-primary">{msg}</p>}
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
    </div>
  );
}

function StateCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold tracking-tight">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

const NUTRIENTS = [
  { label: "Calories", unit: "kcal", min: "calories_min", max: "calories_max" },
  { label: "Protein", unit: "g", min: "protein_min", max: "protein_max" },
  { label: "Carbs", unit: "g", min: "carbs_min", max: "carbs_max" },
  { label: "Fat", unit: "g", min: "fat_min", max: "fat_max" },
] as const;

type NutrientField =
  | "calories_min" | "calories_max"
  | "protein_min" | "protein_max"
  | "carbs_min" | "carbs_max"
  | "fat_min" | "fat_max";

function DishRow({ item, onChanged }: { item: MenuItem; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<null | "verify" | "save" | "hide">(null);
  const [error, setError] = useState<string | null>(null);

  const price =
    item.price_gbp != null ? `£${Number(item.price_gbp).toFixed(2).replace(/\.00$/, "")}` : null;

  async function update(patch: Partial<MenuItem>, kind: "verify" | "save" | "hide") {
    setError(null);
    setSaving(kind);
    const { error: err } = await dbPending.from("menu_items").update(patch).eq("id", item.id);
    setSaving(null);
    if (err) {
      setError(err.message || "Couldn't save. Try again.");
      return;
    }
    setEditing(false);
    onChanged();
  }

  return (
    <article
      className={`rounded-2xl p-4 shadow-[var(--shadow-card)] transition ${
        item.is_verified ? "bg-accent/30 ring-1 ring-primary/30" : "bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-bold tracking-tight leading-snug">{item.name}</h4>
          {item.description && (
            <p className="mt-0.5 text-sm text-muted-foreground leading-snug">{item.description}</p>
          )}
        </div>
        {price && <span className="text-sm font-semibold tabular-nums">{price}</span>}
      </div>

      {(item.is_verified || item.cooking_fat) && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {item.is_verified && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Check className="h-3 w-3" /> Verified
            </span>
          )}
          {item.cooking_fat && (
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
              {COOKING_FAT_LABEL[item.cooking_fat]}
            </span>
          )}
        </div>
      )}

      {!editing ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {NUTRIENTS.map((n) => (
              <div key={n.label} className="flex items-center justify-between">
                <dt className="text-muted-foreground">{n.label}</dt>
                <dd className="font-medium tabular-nums">
                  {formatRange(
                    item[n.min] as number | null,
                    item[n.max] as number | null,
                    ` ${n.unit}`,
                  ) ?? "—"}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 grid gap-2">
            <button
              onClick={() => update({ is_verified: true }, "verify")}
              disabled={saving !== null}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
            >
              {saving === "verify" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Looks right
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setEditing(true)}
                disabled={saving !== null}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-semibold text-secondary-foreground transition hover:bg-accent disabled:opacity-60"
              >
                <SlidersHorizontal className="h-4 w-4" /> Adjust
              </button>
              <button
                onClick={() => update({ is_active: false }, "hide")}
                disabled={saving !== null}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary text-sm font-medium text-muted-foreground transition hover:bg-accent disabled:opacity-60"
              >
                {saving === "hide" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                Not on our menu
              </button>
            </div>
          </div>
        </>
      ) : (
        <AdjustEditor
          item={item}
          saving={saving === "save"}
          onCancel={() => setEditing(false)}
          onSave={(patch) => update({ ...patch, is_verified: true }, "save")}
        />
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </article>
  );
}

// Falls back to splitting the legacy freeform `description` into rows (no
// amounts) the first time a dish is adjusted post-upgrade; once saved,
// ingredients_detail becomes the source of truth and this fallback no
// longer applies.
function initialIngredientRows(item: MenuItem): IngredientDetail[] {
  if (item.ingredients_detail && item.ingredients_detail.length > 0) {
    return item.ingredients_detail;
  }
  if (item.description) {
    const rows = item.description
      .split(",")
      .map((s) => ({ name: s.trim(), amount: "" }))
      .filter((r) => r.name);
    if (rows.length > 0) return rows;
  }
  return [{ name: "", amount: "" }];
}

const COOKING_FAT_OPTIONS: CookingFat[] = ["dry", "light", "generous"];

function AdjustEditor({
  item,
  saving,
  onCancel,
  onSave,
}: {
  item: MenuItem;
  saving: boolean;
  onCancel: () => void;
  onSave: (patch: Partial<MenuItem>) => void;
}) {
  const [ingredients, setIngredients] = useState<IngredientDetail[]>(() => initialIngredientRows(item));
  const [cookingFat, setCookingFat] = useState<CookingFat | null>(item.cooking_fat ?? null);
  const [values, setValues] = useState<Record<NutrientField, string>>(() => {
    const initial = {} as Record<NutrientField, string>;
    for (const n of NUTRIENTS) {
      initial[n.min] = item[n.min] != null ? String(item[n.min]) : "";
      initial[n.max] = item[n.max] != null ? String(item[n.max]) : "";
    }
    return initial;
  });

  const setField = (field: NutrientField, v: string) =>
    setValues((cur) => ({ ...cur, [field]: v }));

  const setIngredient = (i: number, field: "name" | "amount", v: string) =>
    setIngredients((cur) => cur.map((row, idx) => (idx === i ? { ...row, [field]: v } : row)));
  const addIngredient = () => setIngredients((cur) => [...cur, { name: "", amount: "" }]);
  const removeIngredient = (i: number) => setIngredients((cur) => cur.filter((_, idx) => idx !== i));

  const toNum = (v: string): number | null => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  function save() {
    const cleanIngredients = ingredients
      .map((r) => ({ name: r.name.trim(), amount: r.amount.trim() }))
      .filter((r) => r.name);
    const descriptionJoin = cleanIngredients
      .map((r) => (r.amount ? `${r.name} (${r.amount})` : r.name))
      .join(", ");
    const patch: Partial<MenuItem> = {
      description: descriptionJoin || null,
      ingredients_detail: cleanIngredients.length > 0 ? cleanIngredients : null,
      cooking_fat: cookingFat,
    };
    for (const n of NUTRIENTS) {
      (patch as Record<string, number | null>)[n.min] = toNum(values[n.min]);
      (patch as Record<string, number | null>)[n.max] = toNum(values[n.max]);
    }
    onSave(patch);
  }

  return (
    <div className="mt-3">
      <div className="grid gap-3">
        <div>
          <label className="text-sm font-semibold">Ingredients</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Amount is optional — add it only where you actually know it (e.g. a
            weighed portion). It's fine to leave it blank.
          </p>
          <div className="mt-2 grid gap-1.5">
            {ingredients.map((row, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input
                  value={row.name}
                  onChange={(e) => setIngredient(i, "name", e.target.value)}
                  placeholder="e.g. Hummus"
                  aria-label={`Ingredient ${i + 1} name`}
                  className="h-11 min-w-0 flex-1 rounded-xl bg-secondary px-3 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
                <input
                  value={row.amount}
                  onChange={(e) => setIngredient(i, "amount", e.target.value)}
                  placeholder="amount"
                  aria-label={`Ingredient ${i + 1} amount`}
                  className="h-11 w-24 flex-none rounded-xl bg-secondary px-2.5 text-center text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  aria-label="Remove ingredient"
                  className="flex-none rounded-full p-2 text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="mt-2 text-sm font-semibold text-primary underline-offset-2 hover:underline"
          >
            + Add ingredient
          </button>
        </div>

        <div>
          <label className="text-sm font-semibold">Cooking fat</label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The single biggest hidden calorie swing — pick the closest, or leave
            it if you're not sure.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {COOKING_FAT_OPTIONS.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setCookingFat((cur) => (cur === opt ? null : opt))}
                className={`h-9 rounded-full px-3 text-sm font-medium transition ${
                  cookingFat === opt
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {COOKING_FAT_LABEL[opt]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold">Nutrition ranges</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Not sure of the exact number? A range is fine — e.g. recipes vary by
            how much oil or dressing is used.
          </p>
        </div>
        {NUTRIENTS.map((n) => (
          <div key={n.label}>
            <label className="text-sm font-semibold">
              {n.label} <span className="font-normal text-muted-foreground">({n.unit})</span>
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                inputMode="numeric"
                value={values[n.min]}
                onChange={(e) => setField(n.min, e.target.value)}
                placeholder="from"
                aria-label={`${n.label} minimum`}
                className="h-12 w-full rounded-xl bg-secondary px-3 text-center text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-muted-foreground">–</span>
              <input
                inputMode="numeric"
                value={values[n.max]}
                onChange={(e) => setField(n.max, e.target.value)}
                placeholder="to"
                aria-label={`${n.label} maximum`}
                className="h-12 w-full rounded-xl bg-secondary px-3 text-center text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-[1fr_2fr] gap-2">
        <button
          onClick={onCancel}
          disabled={saving}
          className="inline-flex h-12 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground transition hover:bg-accent disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Save &amp; verify
        </button>
      </div>
    </div>
  );
}
