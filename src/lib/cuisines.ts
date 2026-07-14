// Fixed cuisine taxonomy (London-focused). This is the source of truth for the
// cuisine filter and the "Trending near you" tiles. Each restaurant carries a
// subset of these as a `cuisines` text[] column (a restaurant can have several).

export const CUISINE_TAGS = [
  "Italian", "Pizza", "French", "Spanish", "Portuguese", "Greek", "Mediterranean", "European", "British",
  "Turkish", "Lebanese", "Middle Eastern", "Persian",
  "Indian", "Pakistani", "Bangladeshi", "Nepalese", "Sri Lankan",
  "Chinese", "Japanese", "Korean", "Thai", "Vietnamese", "Malaysian", "Filipino",
  "Mexican", "American", "Caribbean", "Nigerian", "West African", "Ethiopian",
  "Halal", "Seafood", "BBQ & Grill", "Burgers", "Chicken",
  "Brunch", "Breakfast", "Coffee & Café", "Bakery", "Dessert",
  "Healthy", "Vegan", "Vegetarian", "Gluten Free",
] as const;

export type CuisineTag = (typeof CUISINE_TAGS)[number];

// Grouped presentation for the filter UI, so the 45 tags read as a sensible
// menu rather than one giant blob. Every tag appears in exactly one group.
export const CUISINE_GROUPS: { label: string; tags: CuisineTag[] }[] = [
  {
    label: "European",
    tags: ["Italian", "Pizza", "French", "Spanish", "Portuguese", "Greek", "Mediterranean", "European", "British"],
  },
  { label: "Middle Eastern", tags: ["Turkish", "Lebanese", "Middle Eastern", "Persian"] },
  { label: "South Asian", tags: ["Indian", "Pakistani", "Bangladeshi", "Nepalese", "Sri Lankan"] },
  {
    label: "East & Southeast Asian",
    tags: ["Chinese", "Japanese", "Korean", "Thai", "Vietnamese", "Malaysian", "Filipino"],
  },
  { label: "Americas", tags: ["Mexican", "American", "Caribbean"] },
  { label: "African", tags: ["Nigerian", "West African", "Ethiopian"] },
  { label: "By dish", tags: ["Halal", "Seafood", "BBQ & Grill", "Burgers", "Chicken"] },
  { label: "Morning & sweet", tags: ["Brunch", "Breakfast", "Coffee & Café", "Bakery", "Dessert"] },
  { label: "Dietary", tags: ["Healthy", "Vegan", "Vegetarian", "Gluten Free"] },
];

// Transitional fallback: until the `cuisines` column is populated in the
// database (see migration add_restaurant_cuisines), map the current restaurants
// to their taxonomy tags so the UI works. Once rows carry a real `cuisines`
// array, this is never consulted.
const CUISINE_BACKFILL: Record<string, CuisineTag[]> = {
  "Acme Fire Cult": ["BBQ & Grill", "British", "European"],
  "215 Hackney": ["Middle Eastern", "Brunch", "Healthy"],
  "The Good Egg": ["Middle Eastern", "Brunch", "Breakfast"],
  "Zer Middle East Kitchen": ["Middle Eastern", "Turkish", "Persian"],
};

/** A restaurant's cuisine tags, preferring the real column and falling back to
 *  the transitional map while the migration hasn't been applied yet. */
export function restaurantCuisines(r: {
  name?: string | null;
  cuisines?: string[] | null;
}): string[] {
  if (r.cuisines && r.cuisines.length > 0) return r.cuisines;
  if (r.name && CUISINE_BACKFILL[r.name]) return CUISINE_BACKFILL[r.name];
  return [];
}
