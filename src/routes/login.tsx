import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useOwnerAuth } from "@/hooks/useOwnerAuth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in · FUELO" },
      { name: "description", content: "Sign in as a restaurant owner or Fuelo admin." },
    ],
  }),
});

// One sign-in front door for both restaurant owners and the Fuelo admin —
// same Supabase Auth magic link /verify and /admin already used separately,
// just routed by role afterwards so nobody needs to know which URL to visit.
// /verify and /admin keep their own login forms too (unchanged, zero risk);
// this only adds a single entry point on top.
function LoginPage() {
  const { email, loading, isAdmin } = useOwnerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !email) return;
    navigate({ to: isAdmin ? "/admin" : "/verify", replace: true });
  }, [loading, email, isAdmin, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-2xl font-extrabold tracking-tight">Sign in</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          For restaurant owners and Fuelo admins.
        </p>
        {loading || email ? (
          <div className="mt-8 flex justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </main>
  );
}

function LoginForm() {
  const [emailInput, setEmailInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = emailInput.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;
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
      <div className="mt-8 rounded-2xl bg-card p-6 text-center shadow-[var(--shadow-card)]">
        <p className="inline-flex items-center justify-center gap-2 text-base font-bold tracking-tight text-primary">
          <Mail className="h-5 w-5" /> Check your email
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          We've sent a login link to{" "}
          <span className="font-medium text-foreground">{emailInput.trim().toLowerCase()}</span>.
          Open it on this device — you'll land on the right dashboard automatically.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 grid gap-2 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)]"
    >
      <input
        type="email"
        required
        value={emailInput}
        onChange={(e) => setEmailInput(e.target.value)}
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
  );
}
