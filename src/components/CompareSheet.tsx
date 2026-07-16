import { X } from "lucide-react";
import { useCompare } from "@/components/CompareProvider";
import { formatRange } from "@/lib/fuelo-types";
import type { CompareItem } from "@/lib/compare";

const ROWS: { label: string; render: (i: CompareItem) => string }[] = [
  { label: "Restaurant", render: (i) => i.restaurantName },
  {
    label: "Price",
    render: (i) =>
      i.price_gbp != null ? `£${Number(i.price_gbp).toFixed(2).replace(/\.00$/, "")}` : "—",
  },
  { label: "Calories", render: (i) => formatRange(i.calories_min, i.calories_max, " kcal") ?? "—" },
  { label: "Protein", render: (i) => formatRange(i.protein_min, i.protein_max, "g") ?? "—" },
  { label: "Carbs", render: (i) => formatRange(i.carbs_min, i.carbs_max, "g") ?? "—" },
  { label: "Fat", render: (i) => formatRange(i.fat_min, i.fat_max, "g") ?? "—" },
];

export function CompareSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { items, remove, clear } = useCompare();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close compare"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div className="relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-lg sm:rounded-3xl">
        <div className="border-b border-border bg-background px-5 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Compare dishes</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="overflow-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nothing to compare yet — tap "Compare" on a dish to add it here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="w-16" />
                    {items.map((i) => (
                      <th key={i.id} className="min-w-[120px] px-2 pb-3 text-left align-top">
                        <div className="flex items-start justify-between gap-1">
                          <span className="font-bold leading-snug">{i.name}</span>
                          <button
                            onClick={() => remove(i.id)}
                            aria-label={`Remove ${i.name} from comparison`}
                            className="-mr-1 flex-none rounded-full p-1 text-muted-foreground hover:bg-muted"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-t border-border">
                      <td className="py-2.5 pr-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {row.label}
                      </td>
                      {items.map((i) => (
                        <td key={i.id} className="px-2 py-2.5 font-medium tabular-nums">
                          {row.render(i)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-border bg-background px-5 py-3">
          <button
            onClick={clear}
            disabled={items.length === 0}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            Clear all
          </button>
        </div>
      </div>
    </div>
  );
}
