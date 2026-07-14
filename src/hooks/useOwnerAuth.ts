import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// The initial admin who can onboard owners (keep in sync with the RLS policies
// in migration 20260714200000_restaurant_owners_and_verify). This client-side
// check only controls what UI is shown — the database RLS is the real gate.
export const ADMIN_EMAIL = "harshilmagecha@outlook.com";

/** Current Supabase Auth session (email magic link). `session === undefined`
 *  means still loading; `null` means signed out. */
export function useOwnerAuth() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const email = session?.user?.email ?? null;
  return {
    session,
    email,
    loading: session === undefined,
    isAdmin: !!email && email.toLowerCase() === ADMIN_EMAIL,
    signOut: () => supabase.auth.signOut(),
  };
}
