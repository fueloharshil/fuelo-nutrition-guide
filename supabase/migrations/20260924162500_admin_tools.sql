-- Two additions for the admin side of the app:
--
--   1) A fourth restaurant_events event_type, `action_click`, for the
--      restaurant page's Order Online / Book a Table / Directions / Call
--      buttons ("redirects" — someone leaving Fuelo toward the restaurant's
--      own channel). Reuses `filter_type` to name which button, same as
--      search_match reuses it for the filter label — no new column needed.
--   2) Admin-only INSERT/UPDATE/DELETE on restaurants, so the admin can add
--      a new restaurant from the app instead of the Supabase table editor.
--      Coexists with the existing owner column-scoped UPDATE policy — RLS
--      policies for the same command are OR'd together, so this only ever
--      *adds* access, never narrows what an owner can already do.

ALTER TABLE public.restaurant_events
  DROP CONSTRAINT IF EXISTS restaurant_events_event_type_check;
ALTER TABLE public.restaurant_events
  ADD CONSTRAINT restaurant_events_event_type_check
  CHECK (event_type IN ('profile_view', 'menu_item_view', 'search_match', 'action_click'));

GRANT INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
DROP POLICY IF EXISTS "Admin manages restaurants" ON public.restaurants;
CREATE POLICY "Admin manages restaurants"
  ON public.restaurants FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');
