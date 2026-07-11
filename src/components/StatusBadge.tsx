import { CheckCircle2, Sparkles } from "lucide-react";

export function StatusBadge({ verified }: { verified: boolean }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
        <CheckCircle2 className="h-3 w-3" />
        Restaurant Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[11px] font-medium">
      <Sparkles className="h-3 w-3" />
      AI Estimated
    </span>
  );
}
