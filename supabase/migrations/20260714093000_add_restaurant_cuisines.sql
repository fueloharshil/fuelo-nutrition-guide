-- Introduce a structured cuisine taxonomy on restaurants. A restaurant can
-- have several cuisine tags, so store them as a text[] array. The freeform
-- `cuisine` column is intentionally kept for now.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cuisines text[] NOT NULL DEFAULT '{}';

-- Backfill the existing restaurants with taxonomy tags.
UPDATE public.restaurants
  SET cuisines = ARRAY['BBQ & Grill', 'British', 'European']
  WHERE name = 'Acme Fire Cult';

UPDATE public.restaurants
  SET cuisines = ARRAY['Middle Eastern', 'Brunch', 'Healthy']
  WHERE name = '215 Hackney';

UPDATE public.restaurants
  SET cuisines = ARRAY['Middle Eastern', 'Brunch', 'Breakfast']
  WHERE name = 'The Good Egg';

UPDATE public.restaurants
  SET cuisines = ARRAY['Middle Eastern', 'Turkish', 'Persian']
  WHERE name = 'Zer Middle East Kitchen';
