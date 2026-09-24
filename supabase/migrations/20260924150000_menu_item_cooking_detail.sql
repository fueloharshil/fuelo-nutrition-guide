-- Two owner-facing accuracy signals for a dish, both optional (a dish with
-- neither set behaves exactly as before):
--
--   * cooking_fat — how much oil/fat is used. The single highest-leverage
--     unknown for calorie accuracy that most independent kitchens genuinely
--     can't quantify precisely (a chef doesn't measure the oil in a pan of
--     hummus) — a light-touch tag instead of asking for a number nobody
--     actually knows.
--   * ingredients_detail — structured ingredient rows (name + optional
--     amount, e.g. "Hummus" / "150g"), the foundation for a future
--     AI-assisted recompute step. The Adjust editor still derives a
--     human-readable join of these into `description` on save, so every
--     existing reader of `description` (the public menu, ShareSheet, etc.)
--     needs no changes.
--
-- No RLS changes needed: both columns live on menu_items, whose existing
-- "public SELECT" / "Owner updates own restaurant dishes" policies
-- (migration 20260714200000_restaurant_owners_and_verify) already apply to
-- the whole row, not a fixed column list.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS cooking_fat text
    CHECK (cooking_fat IS NULL OR cooking_fat IN ('dry', 'light', 'generous')),
  ADD COLUMN IF NOT EXISTS ingredients_detail jsonb;
