import { Check, Plus } from "lucide-react";
import { useCompare } from "@/components/CompareProvider";
import { MAX_COMPARE, type CompareItem } from "@/lib/compare";

// Small toggle used on dish cards (restaurant page + Feed). Cards on Feed are
// wrapped in a <Link>, so clicks here must not bubble into navigation.
export function CompareToggleButton({ item }: { item: CompareItem }) {
  const { isSelected, toggle, canAddMore } = useCompare();
  const selected = isSelected(item.id);
  const disabled = !selected && !canAddMore;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      disabled={disabled}
      aria-pressed={selected}
      title={disabled ? `You can compare up to ${MAX_COMPARE} dishes at a time` : undefined}
      className={`inline-flex flex-none items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 ${
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {selected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
      {selected ? "Comparing" : "Compare"}
    </button>
  );
}
