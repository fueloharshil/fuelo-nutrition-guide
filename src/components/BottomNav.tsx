import { Link } from "@tanstack/react-router";
import { Map, Sparkles, Bookmark, User } from "lucide-react";

export type NavTab = "discover" | "feed" | "saved" | "profile";

const TABS: { id: NavTab; label: string; to: string; icon: typeof Map }[] = [
  { id: "discover", label: "Discover", to: "/", icon: Map },
  { id: "feed", label: "Feed", to: "/feed", icon: Sparkles },
  { id: "saved", label: "Saved", to: "/saved", icon: Bookmark },
  { id: "profile", label: "Profile", to: "/profile", icon: User },
];

export function BottomNav({ active }: { active: NavTab }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[500] border-t border-border bg-card"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ id, label, to, icon: Icon }) => {
          const isActive = id === active;
          return (
            <li key={id} className="flex-1">
              <Link
                to={to}
                aria-current={isActive ? "page" : undefined}
                className="flex flex-col items-center justify-center gap-1 py-2.5 text-[11px]"
              >
                <span
                  className={`h-1 w-1 rounded-full ${isActive ? "bg-primary" : "bg-transparent"}`}
                  aria-hidden
                />
                <Icon
                  className={`h-5 w-5 ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={
                    isActive
                      ? "font-semibold text-primary"
                      : "font-medium text-muted-foreground"
                  }
                >
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
