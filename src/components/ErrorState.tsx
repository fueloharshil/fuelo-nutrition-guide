import { AlertTriangle } from "lucide-react";

/** Shared friendly error treatment for a route's errorComponent — replaces
 *  bare "Couldn't load: {message}" text with an icon, a plain-language
 *  message, and (when a reset is available) a "Try again" retry button. */
export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-8 text-center">
      <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-semibold text-foreground">Something went wrong</p>
        <p className="mt-1 text-sm text-muted-foreground">
          We couldn't load this page. Please try again.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex h-10 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-95"
        >
          Try again
        </button>
      )}
    </div>
  );
}
