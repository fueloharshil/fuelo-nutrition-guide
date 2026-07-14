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
  created_at?: string;
};

export type RestaurantOwner = {
  id: string;
  email: string;
  restaurant_id: string | null;
  created_at?: string;
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
