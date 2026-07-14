import { X, SlidersHorizontal, Check } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { useFilters } from "@/components/FiltersProvider";
import {
  CAL_MAX,
  CAL_MIN,
  CAL_STEP,
  PROTEIN_MAX,
  PROTEIN_MIN,
  PROTEIN_STEP,
  DIETARY_KEYS,
  activeFilterCount,
  anyFilterActive,
} from "@/lib/filters";
import { CUISINE_GROUPS } from "@/lib/cuisines";

export function FilterSheet({
  open,
  onClose,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  resultCount: number;
}) {
  const { filters, patch, toggleDietary, reset } = useFilters();
  if (!open) return null;

  // Slider positions. The extreme end of each slider means "no limit".
  const calValue = filters.maxCalories ?? CAL_MAX;
  const proteinValue = filters.minProtein ?? PROTEIN_MIN;
  const count = activeFilterCount(filters);

  return (
    <div className="fixed inset-0 z-[600] flex items-end justify-center sm:items-center">
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
      />
      <div className="relative flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-3xl bg-background shadow-[var(--shadow-float)] sm:max-w-md sm:rounded-3xl">
        {/* Header */}
        <div className="border-b border-border bg-background px-5 pb-3 pt-4">
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-border sm:hidden" />
          <div className="flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
              <SlidersHorizontal className="h-4 w-4 text-primary" /> Filters
            </h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-6 overflow-y-auto px-5 py-5">
          {/* Max calories */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold">Max calories</label>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {filters.maxCalories == null ? "Any" : `≤ ${filters.maxCalories} kcal`}
              </span>
            </div>
            <Slider
              min={CAL_MIN}
              max={CAL_MAX}
              step={CAL_STEP}
              value={[calValue]}
              onValueChange={([v]) => patch({ maxCalories: v >= CAL_MAX ? null : v })}
              aria-label="Maximum calories"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{CAL_MIN} kcal</span>
              <span>Any</span>
            </div>
          </section>

          {/* Min protein */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold">Min protein</label>
              <span className="text-sm font-semibold tabular-nums text-primary">
                {filters.minProtein == null ? "Any" : `≥ ${filters.minProtein} g`}
              </span>
            </div>
            <Slider
              min={PROTEIN_MIN}
              max={PROTEIN_MAX}
              step={PROTEIN_STEP}
              value={[proteinValue]}
              onValueChange={([v]) => patch({ minProtein: v <= PROTEIN_MIN ? null : v })}
              aria-label="Minimum protein"
            />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>Any</span>
              <span>{PROTEIN_MAX} g</span>
            </div>
          </section>

          {/* Dietary */}
          <section>
            <label className="mb-2 block text-sm font-semibold">Dietary</label>
            <div className="flex flex-wrap gap-2">
              {DIETARY_KEYS.map((k) => {
                const active = filters.dietary.includes(k);
                return (
                  <button
                    key={k}
                    onClick={() => toggleDietary(k)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-[0.98] ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {active && <Check className="h-3.5 w-3.5" />}
                    {k}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Cuisine — fixed taxonomy, grouped so it reads as a menu */}
          <section>
            <label className="mb-2 block text-sm font-semibold">Cuisine</label>
            <div className="space-y-4">
              {CUISINE_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group.label}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {group.tags.map((c) => {
                      const active = filters.cuisine === c;
                      return (
                        <button
                          key={c}
                          onClick={() => patch({ cuisine: active ? null : c })}
                          aria-pressed={active}
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] ${
                            active
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-secondary-foreground hover:bg-accent"
                          }`}
                        >
                          {active && <Check className="h-3.5 w-3.5" />}
                          {c}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t border-border bg-background px-5 py-3">
          <button
            onClick={reset}
            disabled={!anyFilterActive(filters)}
            className="text-sm font-medium text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            Reset{count > 0 ? ` (${count})` : ""}
          </button>
          <button
            onClick={onClose}
            className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition hover:opacity-95"
          >
            Show {resultCount} {resultCount === 1 ? "spot" : "spots"}
          </button>
        </div>
      </div>
    </div>
  );
}
