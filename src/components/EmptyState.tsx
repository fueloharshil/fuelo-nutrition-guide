import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Shared "nothing here yet" treatment — icon + message, never a blank
 *  screen. Used for empty lists/sections (Saved, Feed, zero filter matches,
 *  a restaurant's empty menu, an owner's activity-free analytics). */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-2xl bg-card p-8 text-center shadow-[var(--shadow-card)] ${className}`}
    >
      <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-secondary text-muted-foreground">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
