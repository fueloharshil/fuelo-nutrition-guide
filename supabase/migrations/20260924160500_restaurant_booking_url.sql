-- "Book a Table" — a restaurant's own reservation link (OpenTable,
-- SevenRooms, Resy, or just a booking page on their own site), shown as a
-- fourth action button on the restaurant page alongside Order Online /
-- Directions / Call. Same optional-field pattern as external_order_url:
-- hidden when unset, owner-editable from /verify.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS booking_url text;

-- Extend the existing owner contact-fields column grant (migration
-- 20260717090000_restaurant_contact_fields) to include booking_url. The row
-- policy is unchanged — it already scopes by "your own restaurant", not by
-- column.
GRANT UPDATE (phone, external_order_url, booking_url) ON public.restaurants TO authenticated;
