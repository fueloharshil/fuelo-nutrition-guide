import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Your profile · FUELO" },
      { name: "description", content: "Set your goals and location on FUELO." },
    ],
  }),
});

function ProfilePage() {
  const router = useRouter();
  return (
    <main className="min-h-screen px-4 pt-5 sm:px-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mt-8 max-w-md">
        <h1 className="text-3xl font-extrabold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set your goals and location — coming soon
        </p>
      </div>
      <div className="mt-6 rounded-2xl bg-card p-6 shadow-[var(--shadow-card)] max-w-md">
        <p className="text-sm text-muted-foreground">
          We're building goal-based filters (protein targets, calorie budgets) and
          location-aware discovery. Want early access?{" "}
          <Link to="/" className="text-primary underline font-medium">
            Join the waitlist on Discover
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
