import { Link } from "@tanstack/react-router";
import { Target, ChevronRight } from "lucide-react";
import { useProfile } from "@/components/ProfileProvider";

export function DailyBudgetCard() {
  const { hasGoal, profile, remainingCalories, remainingProtein } = useProfile();

  if (!hasGoal) {
    return (
      <Link
        to="/profile"
        className="mx-4 sm:mx-6 mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)] transition hover:shadow-[var(--shadow-float)]"
      >
        <span className="inline-flex items-center gap-2 text-sm font-medium">
          <Target className="h-4 w-4 flex-none text-primary" />
          Set your daily goal to track today's budget
        </span>
        <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
      </Link>
    );
  }

  return (
    <div className="mx-4 sm:mx-6 mt-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Today's budget
        </span>
        <Link to="/profile" className="text-[11px] font-medium text-primary hover:underline">
          Edit
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4">
        <BudgetStat remaining={remainingCalories} target={profile.calorieTarget} unit="kcal" />
        <BudgetStat remaining={remainingProtein} target={profile.proteinTarget} unit="g" />
      </div>
    </div>
  );
}

function BudgetStat({ remaining, target, unit }: { remaining: number; target: number; unit: string }) {
  const over = remaining < 0;
  const pct = target > 0 ? Math.max(0, Math.min(100, (remaining / target) * 100)) : 0;

  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span
          className={`text-lg font-extrabold tabular-nums ${over ? "text-destructive" : "text-foreground"}`}
        >
          {Math.round(Math.abs(remaining))}
        </span>
        <span className="text-xs text-muted-foreground">
          {unit} {over ? "over" : "left"}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-destructive" : "bg-primary"}`}
          style={{ width: `${over ? 100 : pct}%` }}
        />
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">of {target} {unit}</p>
    </div>
  );
}
