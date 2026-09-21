// Lightweight, local-only user profile (daily calorie/protein goal +
// dietary preference). No accounts — everything lives in this device's
// localStorage, same pattern as SavedProvider's "fuelo:saved". The goal is
// used purely as a filter (see dishFitsGoal below): there's no logging or
// running total, so this deliberately isn't a food diary or calorie tracker.

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

// A single dish is at most this share of the daily calorie target — a rough
// "largest meal of the day" portion. Keeps the filter meaningful (not every
// dish under a 2000+ kcal daily target) without turning it into a tracker:
// this is evaluated fresh per dish, with no memory of what else was picked.
const MEAL_CALORIE_SHARE = 0.4;

/** A dish "fits your goal" if its calorie midpoint is a reasonable single-meal
 *  portion of the daily target and, when a dietary preference is set, matches
 *  it. Purely a filter against the target — no logging, no running total, so
 *  the same dish always evaluates the same way regardless of what else was
 *  picked today. No goal set → nothing fits (there's no target to match). */
export function dishFitsGoal(item: DishNutrition, profile: Profile): boolean {
  if (!profile.goal) return false;
  const cal = midpoint(item.calories_min, item.calories_max);
  if (cal == null || cal > profile.calorieTarget * MEAL_CALORIE_SHARE) return false;
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
