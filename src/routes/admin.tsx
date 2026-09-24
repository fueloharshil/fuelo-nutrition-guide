import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { LogOut, Loader2, Link2, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { dbPending } from "@/lib/supabasePending";
import type { Restaurant, RestaurantOwner } from "@/lib/fuelo-types";
import { useOwnerAuth, ADMIN_EMAIL } from "@/hooks/useOwnerAuth";

type Lead = { id: string; email: string; restaurant_name: string | null; created_at?: string };

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin · FUELO" }] }),
});

function AdminPage() {
  const { email, loading, isAdmin, signOut } = useOwnerAuth();

  return (
    <main className="min-h-screen pb-16">
      <div className="mx-auto max-w-lg px-4 pt-6 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-extrabold tracking-tight">Admin · onboarding</h1>
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
          <div className="mt-10 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : !email ? (
          <AdminLogin />
        ) : !isAdmin ? (
          <div className="mt-8 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]">
            <h2 className="text-base font-bold tracking-tight">Not authorised</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              You're signed in as <span className="font-medium text-foreground">{email}</span>, which
              isn't an admin account.
            </p>
          </div>
        ) : (
          <AdminConsole />
        )}
      </div>
    </main>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus("loading");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/admin` : undefined;
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

function AdminConsole() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-console"];

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async () => {
      const [rRes, oRes, lRes] = await Promise.all([
        supabase.from("restaurants").select("id,name").order("name"),
        dbPending.from("restaurant_owners").select("*"),
        supabase
          .from("restaurant_leads")
          .select("id,email,restaurant_name,created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (rRes.error) throw rRes.error;
      if (oRes.error) throw oRes.error;
      if (lRes.error) throw lRes.error;
      return {
        restaurants: (rRes.data ?? []) as Pick<Restaurant, "id" | "name">[],
        owners: (oRes.data ?? []) as RestaurantOwner[],
        leads: (lRes.data ?? []) as Lead[],
      };
    },
  });

  const [ownerEmail, setOwnerEmail] = useState("");
  const [restaurantId, setRestaurantId] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    const emailValue = ownerEmail.trim().toLowerCase();
    if (!emailValue || !restaurantId) {
      setErr("Enter an owner email and pick a restaurant.");
      return;
    }
    setSaving(true);
    const existing = (data?.owners ?? []).find((o) => o.email.toLowerCase() === emailValue);
    const res = existing
      ? await dbPending
          .from("restaurant_owners")
          .update({ restaurant_id: restaurantId })
          .eq("id", existing.id)
      : await dbPending
          .from("restaurant_owners")
          .insert({ email: emailValue, restaurant_id: restaurantId });
    setSaving(false);
    if (res.error) {
      setErr(res.error.message);
      return;
    }
    setMsg(`Linked ${emailValue}.`);
    setOwnerEmail("");
    setRestaurantId("");
    queryClient.invalidateQueries({ queryKey });
  }

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
        Couldn't load admin data: {(error as Error).message}
      </div>
    );
  }

  const restaurantName = (id: string | null) =>
    data!.restaurants.find((r) => r.id === id)?.name ?? null;

  return (
    <div className="mt-6 space-y-6">
      <Link
        to="/admin-overview"
        className="inline-block text-sm font-semibold text-primary underline-offset-2 hover:underline"
      >
        ← Restaurant overview (outreach tracking)
      </Link>

      <AddRestaurantForm onAdded={() => queryClient.invalidateQueries({ queryKey })} />

      <form onSubmit={link} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold tracking-tight">Approve &amp; link an owner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Give an owner email access to verify a restaurant's menu.
        </p>
        <div className="mt-3 grid gap-2">
          <input
            type="email"
            value={ownerEmail}
            onChange={(e) => setOwnerEmail(e.target.value)}
            placeholder="owner@restaurant.com"
            className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
          />
          <select
            value={restaurantId}
            onChange={(e) => setRestaurantId(e.target.value)}
            className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40"
          >
            <option value="">Choose a restaurant…</option>
            {data!.restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Link / approve
          </button>
          {msg && <p className="text-xs font-medium text-primary">{msg}</p>}
          {err && <p className="text-xs text-destructive">{err}</p>}
        </div>
      </form>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold tracking-tight">Owners ({data!.owners.length})</h2>
        {data!.owners.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No owners linked yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data!.owners.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{o.email}</span>
                <span className={restaurantName(o.restaurant_id) ? "font-medium" : "text-muted-foreground"}>
                  {restaurantName(o.restaurant_id) ?? "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-base font-bold tracking-tight">Recent claims ({data!.leads.length})</h2>
        {data!.leads.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">No claims submitted yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {data!.leads.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate">{l.email}</span>
                <span className="text-muted-foreground truncate">{l.restaurant_name ?? "—"}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// Lets the admin add a new restaurant directly from the app instead of the
// Supabase table editor. Only name is required — cuisine/area/address are
// freeform, latitude/longitude are optional but needed for the restaurant to
// get a map pin on Discover (it'll still show in List view without them).
// Gated by the "Admin manages restaurants" RLS policy (migration
// 20260924162500_admin_tools), so this insert only ever works for the admin.
function AddRestaurantForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [area, setArea] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const toNum = (v: string): number | null => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!name.trim()) {
      setErr("Enter a restaurant name.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("restaurants").insert({
      name: name.trim(),
      cuisine: cuisine.trim() || null,
      area: area.trim() || null,
      address: address.trim() || null,
      latitude: toNum(latitude),
      longitude: toNum(longitude),
    });
    setSaving(false);
    if (error) {
      setErr(error.message || "Couldn't add it. Try again.");
      return;
    }
    setMsg(`Added ${name.trim()}.`);
    setName("");
    setCuisine("");
    setArea("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    onAdded();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 h-11 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
      >
        <Plus className="h-4 w-4" /> Add a restaurant
      </button>
    );
  }

  return (
    <form onSubmit={add} className="rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
      <h2 className="text-base font-bold tracking-tight">Add a restaurant</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Only the name is required. Add latitude/longitude to give it a map pin —
        it'll still show in List view without them.
      </p>
      <div className="mt-3 grid gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Restaurant name"
          className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <input
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          placeholder="Cuisine, e.g. Middle Eastern brunch"
          className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <input
          value={area}
          onChange={(e) => setArea(e.target.value)}
          placeholder="Area, e.g. Dalston, London"
          className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Address"
          className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            placeholder="Latitude"
            className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
          <input
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            placeholder="Longitude"
            className="h-12 rounded-full bg-secondary px-4 text-[15px] outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
          />
        </div>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-secondary text-sm font-medium text-muted-foreground transition hover:bg-accent"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add restaurant
          </button>
        </div>
        {msg && <p className="text-xs font-medium text-primary">{msg}</p>}
        {err && <p className="text-xs text-destructive">{err}</p>}
      </div>
    </form>
  );
}
