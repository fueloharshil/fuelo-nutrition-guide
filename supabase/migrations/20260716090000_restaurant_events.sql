-- Lightweight owner-facing analytics: profile views, menu item views, and
-- search/filter visibility, shown on the "/verify" owner dashboard.
--
-- Any visitor's browsing triggers these events (anonymous pings, not tied to
-- a user), so anon can INSERT freely — same trust model as user_waitlist /
-- restaurant_leads. Only the restaurant's own linked owner (or the admin) can
-- read them back, matching the pattern in
-- 20260714200000_restaurant_owners_and_verify.
--
-- Columns are used per event_type:
--   profile_view   — restaurant_id only
--   menu_item_view — restaurant_id + menu_item_id
--   search_match   — restaurant_id + filter_type (a display label like
--                    "Max calories" / "Vegan") + search_id (shared by every
--                    row logged from the same filter-apply action, so
--                    COUNT(DISTINCT search_id) = "appeared in N searches",
--                    while COUNT(*) GROUP BY filter_type gives the breakdown)

CREATE TABLE IF NOT EXISTS public.restaurant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('profile_view', 'menu_item_view', 'search_match')),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  filter_type text,
  search_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS restaurant_events_restaurant_idx
  ON public.restaurant_events (restaurant_id, event_type, created_at);

ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;
GRANT INSERT ON public.restaurant_events TO anon, authenticated;
GRANT SELECT ON public.restaurant_events TO authenticated;
GRANT ALL ON public.restaurant_events TO service_role;

CREATE POLICY "Anyone can log an event"
  ON public.restaurant_events FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner reads own restaurant's events"
  ON public.restaurant_events FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_owners
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND restaurant_id IS NOT NULL
    )
  );

CREATE POLICY "Admin reads all events"
  ON public.restaurant_events FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');
