ALTER TABLE public.restaurants

  ADD COLUMN IF NOT EXISTS booking_url text;

GRANT UPDATE (phone, external_order_url, booking_url) ON public.restaurants TO authenticated;