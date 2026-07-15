// Lightweight, local-only user profile (daily calorie/protein goal + dietary
// preference) and a same-day log of dishes eaten. No accounts — everything
// lives in this device's localStorage, same pattern as SavedProvider's
// "fuelo:saved". This is v1: a simple running total for today, not a food
// diary or history.

import { midpoint, tagMatchesDietary, type DishNutrition } from "@/lib/filters";

export type Goal = "lose_weight" | "build_muscle" | "maintain";
export type DietaryPreference = "vegan" | "vegetarian" | "none";

export const GOAL_LABEL: Record<Goal, string> = {
  lose_weight: "Lose weight",
  build_muscle: "Build muscle",
  maintain: "Maintain",
};

// Generic starting points for an average adult, not personalized (no age/
// weight/height/activity level is collected in this v1) — shown as adjustable
// defaults, never as fixed medical guidance.
export const GOAL_DEFAULTS: Record<Goal, { calories: number; protein: number }> = {
  lose_weight: { calories: 1800, protein: 120 },
  build_muscle: { calories: 2600, protein: 160 },
  maintain: { calories: 2200, protein: 100 },
};

export const CALORIE_TARGET_MIN = 1200;
export const CALORIE_TARGET_MAX = 4000;
export const CALORIE_TARGET_STEP = 50;
export const PROTEIN_TARGET_MIN = 40;
export const PROTEIN_TARGET_MAX = 250;
export const PROTEIN_TARGET_STEP = 5;

export type Profile = {
  goal: Goal | null;
  calorieTarget: number;
  proteinTarget: number;
  dietaryPreference: DietaryPreference;
};

export const DEFAULT_PROFILE: Profile = {
  goal: null,
  calorieTarget: GOAL_DEFAULTS.maintain.calories,
  proteinTarget: GOAL_DEFAULTS.maintain.protein,
  dietaryPreference: "none",
};

export type DailyLog = {
  date: string; // YYYY-MM-DD, device-local
  loggedCalories: number;
  loggedProtein: number;
  loggedDishIds: string[];
};

/** Device-local YYYY-MM-DD, used as the daily log's reset key. */
export function todayKey(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function emptyDailyLog(): DailyLog {
  return { date: todayKey(), loggedCalories: 0, loggedProtein: 0, loggedDishIds: [] };
}

/** A dish "fits your goal" if it's within today's remaining calories and,
 *  when a dietary preference is set, matches it. No goal set → nothing fits
 *  (there's no budget to fit into yet). */
export function dishFitsGoal(
  item: DishNutrition,
  profile: Profile,
  remainingCalories: number,
): boolean {
  if (!profile.goal) return false;
  const cal = midpoint(item.calories_min, item.calories_max);
  if (cal == null || cal > remainingCalories) return false;
  if (profile.dietaryPreference === "vegan" && !tagMatchesDietary(item.dietary_tags, "Vegan")) {
    return false;
  }
  if (
    profile.dietaryPreference === "vegetarian" &&
    !tagMatchesDietary(item.dietary_tags, "Vegetarian")
  ) {
    return false;
  }
  return true;
}
