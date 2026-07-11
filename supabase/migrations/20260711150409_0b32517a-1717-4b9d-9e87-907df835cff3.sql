
CREATE TABLE public.restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cuisine text,
  address text,
  area text,
  latitude double precision,
  longitude double precision,
  image_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.restaurants TO service_role;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read restaurants" ON public.restaurants FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  menu_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menus TO anon, authenticated;
GRANT ALL ON public.menus TO service_role;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read menus" ON public.menus FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid REFERENCES public.menus(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  description text,
  price_gbp numeric,
  calories_min integer,
  calories_max integer,
  protein_min numeric,
  protein_max numeric,
  carbs_min numeric,
  carbs_max numeric,
  fat_min numeric,
  fat_max numeric,
  dietary_tags text[] DEFAULT '{}',
  tag_source text CHECK (tag_source IN ('menu-stated','AI-estimated')),
  confidence numeric,
  source text DEFAULT 'AI estimated',
  is_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.menu_items TO anon, authenticated;
GRANT ALL ON public.menu_items TO service_role;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read menu_items" ON public.menu_items FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX ON public.menu_items(restaurant_id);
CREATE INDEX ON public.menu_items(menu_id);
CREATE INDEX ON public.menus(restaurant_id);
