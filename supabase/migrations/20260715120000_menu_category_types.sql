-- Fixes category display order on restaurant menus. Previously order came from
-- a hardcoded list of generic category names matched by exact string, which
-- silently failed whenever a restaurant used its own category naming (e.g.
-- "Sides & Extras" instead of "Sides") — unmatched categories fell back to
-- alphabetical order, which is why "Hot Drinks"/"Cold Drinks" could appear
-- before food. This replaces that with a small reference table mapping every
-- category name to a bucket, so the app can bucket-sort reliably and new
-- categories just need a row here — no code change required.

CREATE TABLE public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_name text NOT NULL,
  category_type text NOT NULL CHECK (
    category_type IN ('starter', 'main', 'side', 'dessert', 'drink_hot', 'drink_cold', 'drink_alcoholic')
  ),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX menu_categories_name_idx ON public.menu_categories (lower(category_name));

GRANT SELECT ON public.menu_categories TO anon, authenticated;
GRANT ALL ON public.menu_categories TO service_role;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read menu_categories" ON public.menu_categories
  FOR SELECT TO anon, authenticated USING (true);

-- Admin can add/edit category-type tags directly (e.g. via the Supabase table
-- editor) whenever a new category name shows up, without a code change.
GRANT INSERT, UPDATE, DELETE ON public.menu_categories TO authenticated;
CREATE POLICY "Admin manages menu_categories" ON public.menu_categories
  FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');

-- Backfill every category name currently used across all 4 restaurants,
-- verified against real dish data (portion size / price), not guessed from
-- the name alone.
INSERT INTO public.menu_categories (category_name, category_type) VALUES
  -- starter
  ('Snacks', 'starter'),
  ('Cold Meze', 'starter'),
  ('Hot Meze', 'starter'),
  ('Mixed Meze', 'starter'),
  ('Cold Small Plates', 'starter'),
  ('Hot Small Plates', 'starter'),
  -- main
  ('Signature Brunch', 'main'),
  ('Sabih', 'main'),
  ('Breakfast', 'main'),
  ('Brunch', 'main'),
  ('Sarnies', 'main'),
  ('Wraps', 'main'),
  ('Large Plates', 'main'),
  ('Large Plate', 'main'),
  ('Chops & Cuts', 'main'),
  ('Feasting Menu', 'main'),
  ('Vegetarian', 'main'),
  -- side
  ('Sides & Extras', 'side'),
  ('Sides', 'side'),
  ('Extras', 'side'),
  -- dessert
  ('Sweet Things', 'dessert'),
  ('Dessert', 'dessert'),
  -- drink_hot
  ('Hot Drinks', 'drink_hot'),
  -- drink_cold
  ('Cold Drinks', 'drink_cold'),
  ('Smoothies', 'drink_cold'),
  ('Smoothie', 'drink_cold'),
  ('Softs', 'drink_cold'),
  ('Housemade Softs', 'drink_cold'),
  -- drink_alcoholic
  ('Beers', 'drink_alcoholic'),
  ('Cocktails', 'drink_alcoholic'),
  ('Beer & Cider', 'drink_alcoholic'),
  ('Wine', 'drink_alcoholic'),
  ('Spirits', 'drink_alcoholic'),
  ('Digestifs', 'drink_alcoholic'),
  ('Fortified', 'drink_alcoholic');
