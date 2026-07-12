import { useState } from "react";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ClaimRestaurantCard({ defaultName }: { defaultName?: string }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState(defaultName ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    const { error: err } = await supabase.from("restaurant_leads").insert({
      email: value,
      restaurant_name: name.trim() || null,
    });
    if (err) {
      setStatus("error");
      setError("Something went wrong. Try again.");
      return;
    }
    setStatus("done");
  }

  return (
    <section className="mx-4 sm:mx-6 mt-8 rounded-2xl bg-card border border-primary/15 p-5 shadow-[var(--shadow-card)]">
      {status === "done" ? (
        <p className="text-sm font-semibold text-primary inline-flex items-center gap-1.5">
          <Check className="h-4 w-4" /> Thanks — we'll be in touch
        </p>
      ) : (
        <>
          <h3 className="text-base font-bold tracking-tight">Own this restaurant?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Claim your free Fuelo profile and verify your nutrition.
          </p>
          <form onSubmit={onSubmit} className="mt-3 grid gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Restaurant name (optional)"
              maxLength={200}
              className="h-11 rounded-full bg-secondary px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@restaurant.com"
              maxLength={255}
              className="h-11 rounded-full bg-secondary px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="mt-1 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-11 text-sm font-semibold hover:opacity-95 transition disabled:opacity-60"
            >
              {status === "loading" ? "Submitting…" : "Claim"}
            </button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </form>
        </>
      )}
    </section>
  );
}
