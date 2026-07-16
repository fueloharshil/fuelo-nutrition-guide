import { createContext, useContext, useState, type ReactNode } from "react";
import { MAX_COMPARE, type CompareItem } from "@/lib/compare";

type Ctx = {
  items: CompareItem[];
  isSelected: (id: string) => boolean;
  toggle: (item: CompareItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  canAddMore: boolean;
};

const CompareCtx = createContext<Ctx | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>([]);

  const value: Ctx = {
    items,
    isSelected: (id) => items.some((i) => i.id === id),
    toggle: (item) =>
      setItems((cur) => {
        if (cur.some((i) => i.id === item.id)) return cur.filter((i) => i.id !== item.id);
        if (cur.length >= MAX_COMPARE) return cur;
        return [...cur, item];
      }),
    remove: (id) => setItems((cur) => cur.filter((i) => i.id !== id)),
    clear: () => setItems([]),
    canAddMore: items.length < MAX_COMPARE,
  };

  return <CompareCtx.Provider value={value}>{children}</CompareCtx.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareCtx);
  if (!ctx) throw new Error("useCompare must be used inside CompareProvider");
  return ctx;
}
