-- Restaurant action buttons on the public restaurant page: phone (Call) and
-- external_order_url (Order Online). "Get Directions" needs no new column —
-- it uses the existing latitude/longitude.
--
-- external_order_url is the restaurant's own choice of where to send
-- customers (their site, Deliveroo, Uber Eats, Just Eat, ...) and is
-- editable by the linked owner from /verify. phone has no owner-facing edit
-- UI yet (out of scope for this change) — it's populated by the admin/table
-- editor for now, and the Call button simply hides itself when it's null.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS external_order_url text;

-- Column-level grant (not a blanket table UPDATE) so an owner authenticated
-- to verify their dishes can only ever change these two fields on their own
-- restaurant row — not name/verified/latitude/longitude/etc.
GRANT UPDATE (phone, external_order_url) ON public.restaurants TO authenticated;

CREATE POLICY "Owner updates own restaurant contact fields"
  ON public.restaurants FOR UPDATE TO authenticated
  USING (
    id IN (
      SELECT restaurant_id FROM public.restaurant_owners
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND restaurant_id IS NOT NULL
    )
  )
  WITH CHECK (
    id IN (
      SELECT restaurant_id FROM public.restaurant_owners
      WHERE lower(email) = lower(auth.jwt() ->> 'email')
        AND restaurant_id IS NOT NULL
    )
  );
