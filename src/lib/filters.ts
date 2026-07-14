// Discover filters — shared between the Discover page (which decides whether a
// restaurant appears) and the restaurant page (which highlights matching dishes).
//
// Filters apply at the DISH level: a restaurant appears if it has at least one
// dish matching ALL active dish-level filters (max calories, min protein,
// dietary). Cuisine is a restaurant-level filter. Calorie/protein comparisons
// use the midpoint of the stored min/max range.

export type DietaryKey = "Vegan" | "Vegetarian" | "Gluten Free";
export const DIETARY_KEYS: DietaryKey[] = ["Vegan", "Vegetarian", "Gluten Free"];

export type DiscoverFilters = {
  maxCalories: number | null;
  minProtein: number | null;
  dietary: DietaryKey[];
  cuisine: string | null;
};

export const EMPTY_FILTERS: DiscoverFilters = {
  maxCalories: null,
  minProtein: null,
  dietary: [],
  cuisine: null,
};

// Slider bounds, derived from the real data spread (calorie midpoints 0–1400,
// protein midpoints 0–85). The extreme value on each slider means "no limit".
export const CAL_MIN = 200;
export const CAL_MAX = 1400;
export const CAL_STEP = 50;
export const PROTEIN_MIN = 0;
export const PROTEIN_MAX = 80;
export const PROTEIN_STEP = 5;

/** Midpoint of a stored min/max range; null when both bounds are missing. */
export function midpoint(min: number | null | undefined, max: number | null | undefined): number | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return (min + max) / 2;
  return (min ?? max) as number;
}

/** Minimal shape needed to test a dish against the filters. */
export type DishNutrition = {
  calories_min: number | null;
  calories_max: number | null;
  protein_min: number | null;
  protein_max: number | null;
  dietary_tags: string[] | null;
};

function tagTokens(tags: string[] | null | undefined): string[] {
  if (!tags) return [];
  return tags.flatMap((t) => t.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

// Tags in the data are inconsistent ("GF" vs "Gluten Free", "Vegan (GF option)",
// "Vegetarian (vegan option)"). Match on tokens so all variants are caught.
// Vegan dishes also satisfy the Vegetarian filter (vegan ⊂ vegetarian).
export function tagMatchesDietary(tags: string[] | null | undefined, key: DietaryKey): boolean {
  const tokens = tagTokens(tags);
  if (tokens.length === 0) return false;
  const isVegan = tokens.includes("vegan");
  if (key === "Vegan") return isVegan;
  if (key === "Vegetarian") return isVegan || tokens.includes("vegetarian") || tokens.includes("veggie");
  // Gluten Free: "GF" token, or the phrase "gluten free" / "gluten-free".
  const noSpace = (tags ?? []).map((t) => t.toLowerCase().replace(/[^a-z0-9]/g, "")).join(" ");
  return tokens.includes("gf") || noSpace.includes("glutenfree");
}

/** Does this dish satisfy ALL active dish-level filters (calories, protein, dietary)? */
export function dishMatchesFilters(item: DishNutrition, f: DiscoverFilters): boolean {
  if (f.maxCalories != null) {
    const c = midpoint(item.calories_min, item.calories_max);
    if (c == null || c > f.maxCalories) return false;
  }
  if (f.minProtein != null) {
    const p = midpoint(item.protein_min, item.protein_max);
    if (p == null || p < f.minProtein) return false;
  }
  for (const key of f.dietary) {
    if (!tagMatchesDietary(item.dietary_tags, key)) return false;
  }
  return true;
}

/** True when any filter that operates on dishes is set. */
export function hasDishLevelFilters(f: DiscoverFilters): boolean {
  return f.maxCalories != null || f.minProtein != null || f.dietary.length > 0;
}

/** True when any filter at all is set. */
export function anyFilterActive(f: DiscoverFilters): boolean {
  return hasDishLevelFilters(f) || f.cuisine != null;
}

/** Number of active filters, for the badge count. */
export function activeFilterCount(f: DiscoverFilters): number {
  let n = 0;
  if (f.maxCalories != null) n++;
  if (f.minProtein != null) n++;
  n += f.dietary.length;
  if (f.cuisine != null) n++;
  return n;
}
