import { dbPending } from "@/lib/supabasePending";
import type { CategoryType, CategoryTypeMap } from "@/lib/menuGrouping";

// menu_categories isn't in the generated Supabase types yet (new table — see
// migration 20260715120000_menu_category_types), so this goes through the
// same typed escape hatch as restaurant_owners/is_active until types.ts is
// regenerated.
//
// Degrades gracefully (empty map) instead of throwing if the table doesn't
// exist yet, so the restaurant page still renders — with the old "unmapped"
// fallback order — in the window between this code shipping and the
// migration being applied, rather than crashing the whole page.
export async function fetchCategoryTypeMap(): Promise<CategoryTypeMap> {
  const { data, error } = await dbPending.from("menu_categories").select("category_name,category_type");
  if (error) {
    console.warn("[categoryTypes] menu_categories unavailable, falling back to unmapped order:", error.message);
    return new Map();
  }
  const map: CategoryTypeMap = new Map();
  for (const row of (data ?? []) as { category_name: string; category_type: CategoryType }[]) {
    map.set(row.category_name.toLowerCase(), row.category_type);
  }
  return map;
}
