import type { MenuItem } from "@/lib/fuelo-types";

// Category display order for a restaurant menu. Shared so the public restaurant
// page and the owner verify dashboard group/order dishes identically.
export const CATEGORY_ORDER = [
  "Snacks",
  "Cold Meze",
  "Hot Meze",
  "Small Plates",
  "Cold Small Plates",
  "Hot Small Plates",
  "Sarnies",
  "Wraps",
  "Large Plates",
  "Chops & Cuts",
  "Mixed Meze",
  "Brunch",
  "Breakfast",
  "Sides",
  "Vegetarian",
  "Feasting Menu",
  "Sweet Things",
  "Dessert",
  "Housemade Softs",
  "Softs",
  "Hot Drinks",
  "Cocktails",
  "Beer & Cider",
  "Wine",
  "Spirits",
  "Digestifs",
  "Fortified",
];

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

export function groupByCategory(
  items: MenuItem[],
  sort: SortKey = "none",
): [string | null, MenuItem[]][] {
  const map = new Map<string | null, MenuItem[]>();
  for (const it of items) {
    const key = it.category || null;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(it);
  }
  if (sort !== "none") {
    for (const [, arr] of map) arr.sort(dishComparator(sort));
  }
  const orderIndex = (key: string | null) => {
    if (key == null) return CATEGORY_ORDER.length + 1;
    const i = CATEGORY_ORDER.findIndex((c) => c.toLowerCase() === key.toLowerCase());
    return i === -1 ? CATEGORY_ORDER.length : i;
  };
  return Array.from(map.entries()).sort(([a], [b]) => {
    const ai = orderIndex(a);
    const bi = orderIndex(b);
    if (ai !== bi) return ai - bi;
    const as = a ?? "";
    const bs = b ?? "";
    return as.localeCompare(bs);
  });
}
