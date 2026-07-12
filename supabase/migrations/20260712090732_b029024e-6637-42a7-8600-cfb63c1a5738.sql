
CREATE TABLE public.user_waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.user_waitlist TO anon, authenticated;
GRANT ALL ON public.user_waitlist TO service_role;
ALTER TABLE public.user_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join waitlist" ON public.user_waitlist FOR INSERT TO anon, authenticated WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255);

CREATE TABLE public.restaurant_leads (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  restaurant_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.restaurant_leads TO anon, authenticated;
GRANT ALL ON public.restaurant_leads TO service_role;
ALTER TABLE public.restaurant_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can submit claim" ON public.restaurant_leads FOR INSERT TO anon, authenticated WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255 AND (restaurant_name IS NULL OR length(restaurant_name) <= 200));
