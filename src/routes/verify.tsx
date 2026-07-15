import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Mail, Check, CheckCircle2, SlidersHorizontal, EyeOff, LogOut, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { dbPending } from "@/lib/supabasePending";
import type { MenuItem, Restaurant, RestaurantOwner } from "@/lib/fuelo-types";
import { formatRange } from "@/lib/fuelo-types";
import { groupByCategory, type CategoryTypeMap } from "@/lib/menuGrouping";
import { fetchCategoryTypeMap } from "@/lib/categoryTypes";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

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
            <p className="mt-0.5 text-sm text-muted-foreground">Verify your menu's nutrition.</p>
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
      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-extrabold tracking-tight">{data.restaurant.name}</h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {verifiedCount} of {total} {total === 1 ? "dish" : "dishes"} verified
        </p>
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

      {item.is_verified && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
          <Check className="h-3 w-3" /> Verified
        </p>
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

  const toNum = (v: string): number | null => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  function save() {
    const patch: Partial<MenuItem> = {};
    for (const n of NUTRIENTS) {
      (patch as Record<string, number | null>)[n.min] = toNum(values[n.min]);
      (patch as Record<string, number | null>)[n.max] = toNum(values[n.max]);
    }
    onSave(patch);
  }

  return (
    <div className="mt-3">
      <div className="grid gap-3">
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
