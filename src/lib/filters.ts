// Discover filters — shared between the Discover page (which decides whether a
// restaurant appears) and the restaurant page (which highlights matching dishes).
//
// Filters apply at the DISH level: a restaurant appears if it has at least one
// dish matching ALL active dish-level filters (max calories, min protein,
// dietary). Cuisine is a restaurant-level filter. Calorie/protein comparisons
// use the midpoint of the stored min/max range.

export type DietaryKey = "Vegan" | "Vegetarian" | "Gluten Free";
export const DIETARY_KEYS: DietaryKey[] = ["Vegan", "Vegetarian", "Gluten Free"];

// Walking/cycling are the promoted default modes (see TRAVEL_MODES below);
// driving is available but de-emphasized in the UI.
export type TravelMode = "walking" | "cycling" | "driving";

// Picking a mode turns on travel-time *display* (a time/steps tag on every
// restaurant card) without narrowing results. maxMinutes additionally turns
// that into a *filter* — null means "Any" (show the time, don't exclude
// anything), matching how maxCalories/minProtein already work.
export type TravelFilter = { mode: TravelMode; maxMinutes: number | null };

export type DiscoverFilters = {
  maxCalories: number | null;
  minProtein: number | null;
  dietary: DietaryKey[];
  cuisine: string | null;
  travel: TravelFilter | null;
};

export const EMPTY_FILTERS: DiscoverFilters = {
  maxCalories: null,
  minProtein: null,
  dietary: [],
  cuisine: null,
  travel: null,
};

// Slider bounds, derived from the real data spread (calorie midpoints 0–1400,
// protein midpoints 0–85). The extreme value on each slider means "no limit".
export const CAL_MIN = 200;
export const CAL_MAX = 1400;
export const CAL_STEP = 50;
export const PROTEIN_MIN = 0;
export const PROTEIN_MAX = 80;
export const PROTEIN_STEP = 5;

export const TRAVEL_MIN = 5;
export const TRAVEL_MAX = 60; // slider max = "Any" (maxMinutes: null)
export const TRAVEL_STEP = 5;

// ~100 steps/minute at a typical walking pace — a rough, clearly-labelled
// estimate (see the "~" in how it's displayed), not a personalized figure.
export const STEPS_PER_MINUTE = 100;

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
  return hasDishLevelFilters(f) || f.cuisine != null || f.travel != null;
}

// Display labels for each dish-level filter criterion, used by search-match
// analytics (see src/lib/analytics.ts). Distinct from dishMatchesFilters:
// that requires ALL active filters to match on the SAME dish (an AND), while
// this checks each criterion independently against ANY of the restaurant's
// dishes — so a "High protein + Vegan" search can attribute the match to
// each filter separately, even if no single dish satisfies both.
export function matchingFilterLabels(items: DishNutrition[], f: DiscoverFilters): string[] {
  const labels: string[] = [];
  if (
    f.maxCalories != null &&
    items.some((it) => {
      const c = midpoint(it.calories_min, it.calories_max);
      return c != null && c <= f.maxCalories!;
    })
  ) {
    labels.push("Max calories");
  }
  if (
    f.minProtein != null &&
    items.some((it) => {
      const p = midpoint(it.protein_min, it.protein_max);
      return p != null && p >= f.minProtein!;
    })
  ) {
    labels.push("Min protein");
  }
  for (const key of f.dietary) {
    if (items.some((it) => tagMatchesDietary(it.dietary_tags, key))) {
      labels.push(key);
    }
  }
  return labels;
}

/** Number of active filters, for the badge count. */
export function activeFilterCount(f: DiscoverFilters): number {
  let n = 0;
  if (f.maxCalories != null) n++;
  if (f.minProtein != null) n++;
  n += f.dietary.length;
  if (f.cuisine != null) n++;
  if (f.travel != null) n++;
  return n;
}

const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  walking: "Walking",
  cycling: "Cycling",
  driving: "Driving",
};

/** Estimated step count for a walk of this many minutes, one-way and round
 *  trip (there-and-back), from the ~100 steps/minute assumption above. */
export function estimateSteps(minutes: number): { oneWay: number; roundTrip: number } {
  const oneWay = Math.round(minutes * STEPS_PER_MINUTE);
  return { oneWay, roundTrip: oneWay * 2 };
}

/** Short label for a travel-time tag/chip, e.g. "12 min walk" or
 *  "Walking" when no specific time is known yet (still loading). */
export function travelLabel(mode: TravelMode, minutes: number | null): string {
  if (minutes == null) return TRAVEL_MODE_LABEL[mode];
  const verb = mode === "walking" ? "walk" : mode === "cycling" ? "cycle" : "drive";
  return `${minutes} min ${verb}`;
}
