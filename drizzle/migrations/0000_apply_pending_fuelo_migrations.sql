ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS cuisines text[] NOT NULL DEFAULT '{}';
UPDATE public.restaurants SET cuisines = ARRAY['BBQ & Grill','British','European'] WHERE name = 'Acme Fire Cult';
UPDATE public.restaurants SET cuisines = ARRAY['Middle Eastern','Brunch','Healthy'] WHERE name = '215 Hackney';
UPDATE public.restaurants SET cuisines = ARRAY['Middle Eastern','Brunch','Breakfast'] WHERE name = 'The Good Egg';
UPDATE public.restaurants SET cuisines = ARRAY['Middle Eastern','Turkish','Persian'] WHERE name = 'Zer Middle East Kitchen';

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  category_type text NOT NULL CHECK (category_type IN ('starter','main','side','dessert','drink_hot','drink_cold','drink_alcoholic')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS menu_categories_name_idx ON public.menu_categories (lower(category_name));
GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read menu_categories" ON public.menu_categories;
CREATE POLICY "Public read menu_categories" ON public.menu_categories FOR SELECT TO anon, authenticated USING (true);
GRANT INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
DROP POLICY IF EXISTS "Admin manages menu_categories" ON public.menu_categories;
CREATE POLICY "Admin manages menu_categories" ON public.menu_categories FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');
INSERT INTO public.menu_categories (category_name, category_type)
SELECT * FROM (VALUES
  ('Snacks','starter'),('Cold Meze','starter'),('Hot Meze','starter'),('Mixed Meze','starter'),
  ('Cold Small Plates','starter'),('Hot Small Plates','starter'),
  ('Signature Brunch','main'),('Sabih','main'),('Breakfast','main'),('Brunch','main'),('Sarnies','main'),
  ('Wraps','main'),('Large Plates','main'),('Large Plate','main'),('Chops & Cuts','main'),('Feasting Menu','main'),('Vegetarian','main'),
  ('Sides & Extras','side'),('Sides','side'),('Extras','side'),
  ('Sweet Things','dessert'),('Dessert','dessert'),
  ('Hot Drinks','drink_hot'),
  ('Cold Drinks','drink_cold'),('Smoothies','drink_cold'),('Smoothie','drink_cold'),('Softs','drink_cold'),('Housemade Softs','drink_cold'),
  ('Beers','drink_alcoholic'),('Cocktails','drink_alcoholic'),('Beer & Cider','drink_alcoholic'),('Wine','drink_alcoholic'),
  ('Spirits','drink_alcoholic'),('Digestifs','drink_alcoholic'),('Fortified','drink_alcoholic')
) AS v(category_name, category_type)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.restaurant_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('profile_view','menu_item_view','search_match')),
  menu_item_id uuid REFERENCES public.menu_items(id) ON DELETE SET NULL,
  filter_type text,
  search_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_events_restaurant_idx ON public.restaurant_events (restaurant_id, event_type, created_at);
GRANT INSERT ON public.restaurant_events TO anon, authenticated;
GRANT SELECT ON public.restaurant_events TO authenticated;
GRANT ALL ON public.restaurant_events TO service_role;
ALTER TABLE public.restaurant_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can log an event" ON public.restaurant_events;
CREATE POLICY "Anyone can log an event" ON public.restaurant_events FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Owner reads own restaurant's events" ON public.restaurant_events;
CREATE POLICY "Owner reads own restaurant's events" ON public.restaurant_events FOR SELECT TO authenticated
  USING (restaurant_id IN (SELECT restaurant_id FROM public.restaurant_owners WHERE lower(email) = lower(auth.jwt() ->> 'email') AND restaurant_id IS NOT NULL));
DROP POLICY IF EXISTS "Admin reads all events" ON public.restaurant_events;
CREATE POLICY "Admin reads all events" ON public.restaurant_events FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');

ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS phone text, ADD COLUMN IF NOT EXISTS external_order_url text;
GRANT UPDATE (phone, external_order_url) ON public.restaurants TO authenticated;
DROP POLICY IF EXISTS "Owner updates own restaurant contact fields" ON public.restaurants;
CREATE POLICY "Owner updates own restaurant contact fields" ON public.restaurants FOR UPDATE TO authenticated
  USING (id IN (SELECT restaurant_id FROM public.restaurant_owners WHERE lower(email) = lower(auth.jwt() ->> 'email') AND restaurant_id IS NOT NULL))
  WITH CHECK (id IN (SELECT restaurant_id FROM public.restaurant_owners WHERE lower(email) = lower(auth.jwt() ->> 'email') AND restaurant_id IS NOT NULL));

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cooking_fat text CHECK (cooking_fat IS NULL OR cooking_fat IN ('dry','light','generous')),
  ADD COLUMN IF NOT EXISTS ingredients_detail jsonb;