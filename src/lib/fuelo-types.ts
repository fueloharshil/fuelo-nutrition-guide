export type Restaurant = {
  id: string;
  name: string;
  cuisine: string | null;
  cuisines?: string[] | null;
  address: string | null;
  area: string | null;
  latitude: number | null;
  longitude: number | null;
  image_url: string | null;
  verified: boolean;
  phone?: string | null;
  external_order_url?: string | null;
  booking_url?: string | null;
  created_at?: string;
};

export type MenuItem = {
  id: string;
  menu_id: string | null;
  restaurant_id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_gbp: number | null;
  calories_min: number | null;
  calories_max: number | null;
  protein_min: number | null;
  protein_max: number | null;
  carbs_min: number | null;
  carbs_max: number | null;
  fat_min: number | null;
  fat_max: number | null;
  dietary_tags: string[] | null;
  tag_source: "menu-stated" | "AI-estimated" | null;
  confidence: number | null;
  source: string | null;
  is_verified: boolean;
  is_active?: boolean;
  cooking_fat?: CookingFat | null;
  ingredients_detail?: IngredientDetail[] | null;
  created_at?: string;
};

// How much oil/fat a dish uses — an owner-set tag, not a computed value (see
// migration 20260924150000_menu_item_cooking_detail). Deliberately coarse:
// most independent kitchens can name this but can't quantify oil in grams.
export type CookingFat = "dry" | "light" | "generous";

export const COOKING_FAT_LABEL: Record<CookingFat, string> = {
  dry: "Dry / grilled",
  light: "Light oil",
  generous: "Generous oil / fried",
};

// A single structured ingredient row (name + optional freeform amount, e.g.
// "150g" or "to taste"). Stored as menu_items.ingredients_detail (jsonb);
// the Adjust editor also derives a human-readable join into `description`
// on save so existing readers of that field need no changes.
export type IngredientDetail = { name: string; amount: string };

export type RestaurantOwner = {
  id: string;
  email: string;
  restaurant_id: string | null;
  created_at?: string;
};

export type RestaurantEventType = "profile_view" | "menu_item_view" | "search_match";

export type RestaurantEvent = {
  id: string;
  restaurant_id: string;
  event_type: RestaurantEventType;
  menu_item_id: string | null;
  filter_type: string | null;
  search_id: string | null;
  created_at: string;
};

export function formatRange(
  min: number | null | undefined,
  max: number | null | undefined,
  unit = "",
): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) {
    if (min === max) return `${Math.round(min)}${unit}`;
    return `${Math.round(min)}–${Math.round(max)}${unit}`;
  }
  const v = (min ?? max)!;
  return `~${Math.round(v)}${unit}`;
}
