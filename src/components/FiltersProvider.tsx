import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  EMPTY_FILTERS,
  type DietaryKey,
  type DiscoverFilters,
} from "@/lib/filters";

type Ctx = {
  filters: DiscoverFilters;
  patch: (partial: Partial<DiscoverFilters>) => void;
  toggleDietary: (key: DietaryKey) => void;
  reset: () => void;
};

const FiltersCtx = createContext<Ctx | null>(null);

// Kept in memory at the root so filters persist while navigating between the
// Discover page and a restaurant page (the root never unmounts).
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DiscoverFilters>(EMPTY_FILTERS);

  const value = useMemo<Ctx>(
    () => ({
      filters,
      patch: (partial) => setFilters((cur) => ({ ...cur, ...partial })),
      toggleDietary: (key) =>
        setFilters((cur) => ({
          ...cur,
          dietary: cur.dietary.includes(key)
            ? cur.dietary.filter((k) => k !== key)
            : [...cur.dietary, key],
        })),
      reset: () => setFilters(EMPTY_FILTERS),
    }),
    [filters],
  );

  return <FiltersCtx.Provider value={value}>{children}</FiltersCtx.Provider>;
}

export function useFilters() {
  const ctx = useContext(FiltersCtx);
  if (!ctx) throw new Error("useFilters must be used inside FiltersProvider");
  return ctx;
}
