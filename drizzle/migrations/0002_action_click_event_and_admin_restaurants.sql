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