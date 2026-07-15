import type { MenuItem } from "@/lib/fuelo-types";

// Category display order for a restaurant menu, shared so the public
// restaurant page and the owner verify dashboard group/order dishes
// identically.
//
// Categories are bucketed into one of these types (from the menu_categories
// table — see migration 20260715120000_menu_category_types) and displayed in
// this fixed order. Within a bucket, categories keep their original menu
// order (see groupByCategory below) rather than being re-sorted.
//
// Adding a new category later needs a row in menu_categories, not a code
// change — see src/lib/categoryTypes.ts.
export type CategoryType =
  | "starter"
  | "main"
  | "side"
  | "dessert"
  | "drink_hot"
  | "drink_cold"
  | "drink_alcoholic";

export const BUCKET_ORDER: CategoryType[] = [
  "starter",
  "main",
  "side",
  "dessert",
  "drink_hot",
  "drink_cold",
  "drink_alcoholic",
];

export type CategoryTypeMap = Map<string, CategoryType>;

export type SortKey = "none" | "protein" | "calories" | "ratio";

function mid(a: number | null, b: number | null): number | null {
  if (a == null && b == null) return null;
  if (a != null && b != null) return (a + b) / 2;
  return (a ?? b) as number;
}

function dishComparator(sort: SortKey) {
  return (x: MenuItem, y: MenuItem) => {
    const key = (m: MenuItem): number => {
      const p = mid(m.protein_min, m.protein_max);
      const c = mid(m.calories_min, m.calories_max);
      if (sort === "protein") return p == null ? -Infinity : p;
      if (sort === "calories") return c == null ? Infinity : c;
      if (p == null || c == null || c === 0) return -Infinity;
      return p / c;
    };
    const kx = key(x);
    const ky = key(y);
    return sort === "calories" ? kx - ky : ky - kx;
  };
}

/**
 * Groups dishes by category and orders the categories by bucket
 * (starter → main → side → dessert → drink_hot → drink_cold →
 * drink_alcoholic), using `categoryTypeMap` (category name, lowercased →
 * bucket) to look up each category's bucket.
 *
 * Within a bucket, categories keep the order they first appear in `items` —
 * callers should fetch items WITHOUT ordering by category, so that order
 * reflects the menu's natural/insertion order rather than an arbitrary one.
 * This relies on Array.prototype.sort being stable (guaranteed since ES2019).
 *
 * A category with no entry in `categoryTypeMap` sorts after every known
 * bucket (better to show it late than to silently drop it or guess wrong).
 */
export function groupByCategory(
  items: MenuItem[],
  sort: SortKey = "none",
  categoryTypeMap: CategoryTypeMap = new Map(),
): [string | null, MenuItem[]][] {
  const map = new Map<string | null, MenuItem[]>();
  for (const it of items) {
    const key = it.category || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  for (const [, arr] of map) {
    if (sort !== "none") {
      arr.sort(dishComparator(sort));
    } else {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  }
  const bucketIndex = (key: string | null) => {
    if (key == null) return BUCKET_ORDER.length + 1;
    const type = categoryTypeMap.get(key.toLowerCase());
    if (!type) return BUCKET_ORDER.length;
    const i = BUCKET_ORDER.indexOf(type);
    return i === -1 ? BUCKET_ORDER.length : i;
  };
  return Array.from(map.entries()).sort(([a], [b]) => bucketIndex(a) - bucketIndex(b));
}
