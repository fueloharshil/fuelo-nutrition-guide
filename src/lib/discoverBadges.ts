// Map-pin badge logic for Discover. One badge max per pin, priority:
// Verified > New > Top Rated.

export type BadgeType = "verified" | "new" | "top-rated";

export const BADGE_LABEL: Record<BadgeType, string> = {
  verified: "Verified",
  new: "New",
  "top-rated": "Top Rated",
};

// A restaurant counts as "New" if it was added within this window.
const NEW_WINDOW_DAYS = 14;

// "Top Rated" has no ratings data yet — this is a placeholder flag until a
// real rating system exists. Add a restaurant's exact name here to flag it
// manually; leave empty otherwise rather than guessing at quality.
const TOP_RATED_NAMES = new Set<string>([]);

export function isNewRestaurant(createdAt: string | null | undefined, now: Date = new Date()): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return false;
  const ageDays = (now.getTime() - created) / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= NEW_WINDOW_DAYS;
}

export function isTopRated(name: string): boolean {
  return TOP_RATED_NAMES.has(name);
}

export function computeBadge(
  restaurant: { name: string; created_at?: string | null },
  hasVerifiedDish: boolean,
): BadgeType | null {
  if (hasVerifiedDish) return "verified";
  if (isNewRestaurant(restaurant.created_at)) return "new";
  if (isTopRated(restaurant.name)) return "top-rated";
  return null;
}
