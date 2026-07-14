-- Restaurant claim & verify flow.
--   * is_active soft-delete flag on dishes (hide without deleting)
--   * restaurant_owners table (who may verify which restaurant)
--   * RLS so a logged-in owner can verify/edit ONLY their own dishes
--   * an initial admin (by email) who can onboard owners and read claim leads
--
-- Owners authenticate with Supabase Auth (email magic link); rows are keyed by
-- that email. Change/extend the admin email below as the team grows.

-- 1) Soft hide/show flag on dishes. Default true so existing dishes stay live.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- 2) Restaurant owners. restaurant_id stays NULL until an admin approves and
--    links the claim to a specific restaurant.
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

-- A logged-in owner may read their own row (to learn which restaurant they own).
CREATE POLICY "Owner reads own row"
  ON public.restaurant_owners FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- The initial admin can onboard owners (create / link / unlink).
CREATE POLICY "Admin manages owners"
  ON public.restaurant_owners FOR ALL TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com')
  WITH CHECK (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');

-- 3) Let an owner UPDATE only their own restaurant's dishes (verify / adjust /
--    hide). Public SELECT is unchanged; anon still cannot write.
GRANT UPDATE ON public.menu_items TO authenticated;
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

-- 4) Admin can read claim leads to onboard from them.
GRANT SELECT ON public.restaurant_leads TO authenticated;
CREATE POLICY "Admin reads leads"
  ON public.restaurant_leads FOR SELECT TO authenticated
  USING (lower(auth.jwt() ->> 'email') = 'harshilmagecha@outlook.com');
