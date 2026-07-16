import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { useCompare } from "@/components/CompareProvider";
import { CompareSheet } from "@/components/CompareSheet";

// Rendered once at the app root so it floats above every page. Positioned
// bottom-left (not bottom-right) to avoid colliding with the Discover map's
// recenter button and Leaflet zoom control, which both live bottom-right.
export function CompareLauncher() {
  const { items } = useCompare();
  const [open, setOpen] = useState(false);

  if (items.length < 2 && !open) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-[550] inline-flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-float)] transition hover:opacity-95 active:scale-[0.98]"
      >
        <ArrowLeftRight className="h-4 w-4" />
        Compare ({items.length})
      </button>
      <CompareSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
