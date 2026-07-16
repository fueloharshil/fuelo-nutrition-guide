import type { MenuItem } from "@/lib/fuelo-types";

// "Compare" lets a user pick 2-3 dishes from any restaurant and see them
// side by side. Session-only (not persisted to localStorage) — unlike Saved
// or the daily goal, a comparison is a transient browsing tool, not a
// durable preference, so it resets on reload like Discover's filters do.

export const MAX_COMPARE = 3;

export type CompareItem = {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  price_gbp: number | null;
  calories_min: number | null;
  calories_max: number | null;
  protein_min: number | null;
  protein_max: number | null;
  carbs_min: number | null;
  carbs_max: number | null;
  fat_min: number | null;
  fat_max: number | null;
};

export function toCompareItem(item: MenuItem, restaurantName: string): CompareItem {
  return {
    id: item.id,
    name: item.name,
    restaurantId: item.restaurant_id,
    restaurantName,
    price_gbp: item.price_gbp,
    calories_min: item.calories_min,
    calories_max: item.calories_max,
    protein_min: item.protein_min,
    protein_max: item.protein_max,
    carbs_min: item.carbs_min,
    carbs_max: item.carbs_max,
    fat_min: item.fat_min,
    fat_max: item.fat_max,
  };
}
