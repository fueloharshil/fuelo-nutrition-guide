import type { MenuItem } from "@/lib/fuelo-types";
import { formatRange } from "@/lib/fuelo-types";

export function NutritionChips({ item, size = "sm" }: { item: MenuItem; size?: "sm" | "md" }) {
  const kcal = formatRange(item.calories_min, item.calories_max, " kcal");
  const p = formatRange(item.protein_min, item.protein_max, "g");
  const c = formatRange(item.carbs_min, item.carbs_max, "g");
  const f = formatRange(item.fat_min, item.fat_max, "g");
  const cls =
    size === "md"
      ? "text-sm px-3 py-1.5"
      : "text-xs px-2.5 py-1";
  return (
    <div className="flex flex-wrap gap-1.5">
      {kcal && (
        <span className={`${cls} rounded-full bg-primary/10 text-primary font-semibold`}>
          {kcal}
        </span>
      )}
      {p && <Chip label="P" value={p} cls={cls} />}
      {c && <Chip label="C" value={c} cls={cls} />}
      {f && <Chip label="F" value={f} cls={cls} />}
    </div>
  );
}

function Chip({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <span className={`${cls} rounded-full bg-secondary text-secondary-foreground font-medium`}>
      <span className="text-muted-foreground mr-1">{label}</span>
      {value}
    </span>
  );
}
