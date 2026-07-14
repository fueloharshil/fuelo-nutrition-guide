import { supabase } from "@/integrations/supabase/client";

// Escape hatch for schema added by a migration that hasn't been applied to the
// live database yet, so it isn't in the auto-generated Supabase types
// (`integrations/supabase/types.ts`) — specifically the `restaurant_owners`
// table and `menu_items.is_active` (see migration
// 20260714200000_restaurant_owners_and_verify).
//
// Once that migration is applied and Lovable regenerates types.ts, these calls
// can move back onto the typed `supabase` client and this file can be deleted.
// Query results are still cast to our app types at each call site.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const dbPending = supabase as unknown as { from: (table: string) => any };
