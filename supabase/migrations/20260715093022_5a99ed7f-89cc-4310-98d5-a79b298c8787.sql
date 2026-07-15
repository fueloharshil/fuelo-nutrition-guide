ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.restaurant_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS restaurant_owners_email_idx
  ON public.restaurant_owners (lower(email));

ALTER TABLE public.restaurant_owners ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurant_owners TO authenticated;
GRANT ALL ON public.restaurant_owners TO service_role;

DROP POLICY IF EXISTS "Owner reads own row" ON public.restaurant_owners;
CREATE POLICY "Owner reads own row"
  ON public.restaurant_owners FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "Admin manages owners" ON public.restaurant_owners;
CREATE POLICY "Admin manages owners"
  ON public.restaurant_owners FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');

GRANT UPDATE ON public.menu_items TO authenticated;
DROP POLICY IF EXISTS "Owner updates own restaurant dishes" ON public.menu_items;
CREATE POLICY "Owner updates own restaurant dishes"
  ON public.menu_items FOR UPDATE TO authenticated
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_owners
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND restaurant_id IS NOT NULL
    )
  )
  WITH CHECK (
    restaurant_id IN (
      SELECT restaurant_id FROM public.restaurant_owners
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND restaurant_id IS NOT NULL
    )
  );

GRANT SELECT ON public.restaurant_leads TO authenticated;
DROP POLICY IF EXISTS "Admin reads leads" ON public.restaurant_leads;
CREATE POLICY "Admin reads leads"
  ON public.restaurant_leads FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');