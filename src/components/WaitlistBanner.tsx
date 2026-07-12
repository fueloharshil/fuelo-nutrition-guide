import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DISMISS_KEY = "fuelo.waitlist.dismissed";
const DONE_KEY = "fuelo.waitlist.done";

export function WaitlistBanner() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY)) return;
    if (localStorage.getItem(DONE_KEY)) {
      setStatus("done");
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const done = status === "done";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const value = email.trim().toLowerCase();
    if (!EMAIL_RE.test(value)) {
      setError("Please enter a valid email.");
      return;
    }
    setStatus("loading");
    const { error: err } = await supabase.from("user_waitlist").insert({ email: value });
    if (err) {
      setStatus("error");
      setError("Something went wrong. Try again.");
      return;
    }
    localStorage.setItem(DONE_KEY, "1");
    setStatus("done");
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  }

  return (
    <div className="mx-4 sm:mx-6 mt-3 rounded-2xl bg-primary/10 border border-primary/20 px-4 py-3 shadow-[var(--shadow-card)] relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-full p-1 hover:bg-primary/10 text-muted-foreground"
      >
        <X className="h-4 w-4" />
      </button>
      {done ? (
        <p className="text-sm font-semibold text-primary inline-flex items-center gap-1.5 pr-6">
          <Check className="h-4 w-4" /> You're on the list
        </p>
      ) : (
        <>
          <p className="text-sm font-semibold pr-6">Get notified when Fuelo launches near you</p>
          <form onSubmit={onSubmit} className="mt-2 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              maxLength={255}
              className="flex-1 h-10 rounded-full bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-primary/40 placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground h-10 px-5 text-sm font-semibold hover:opacity-95 transition disabled:opacity-60"
            >
              {status === "loading" ? "…" : "Join"}
            </button>
          </form>
          {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}
        </>
      )}
    </div>
  );
}
