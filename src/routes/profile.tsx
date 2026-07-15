import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Check, Info } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { Slider } from "@/components/ui/slider";
import { useProfile } from "@/components/ProfileProvider";
import {
  GOAL_LABEL,
  CALORIE_TARGET_MIN,
  CALORIE_TARGET_MAX,
  CALORIE_TARGET_STEP,
  PROTEIN_TARGET_MIN,
  PROTEIN_TARGET_MAX,
  PROTEIN_TARGET_STEP,
  type Goal,
  type DietaryPreference,
} from "@/lib/profile";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
  head: () => ({
    meta: [
      { title: "Your profile · FUELO" },
      { name: "description", content: "Set your daily calorie and protein goal on FUELO." },
    ],
  }),
});

const GOALS: Goal[] = ["lose_weight", "build_muscle", "maintain"];
const DIETARY_OPTIONS: { key: DietaryPreference; label: string }[] = [
  { key: "none", label: "No preference" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
];

function ProfilePage() {
  const router = useRouter();
  const { profile, setGoal, setCalorieTarget, setProteinTarget, setDietaryPreference } =
    useProfile();

  return (
    <main className="min-h-screen pb-24 px-4 pt-5 sm:px-6">
      <button
        onClick={() => router.history.back()}
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="mt-8 max-w-md">
        <h1 className="text-3xl font-extrabold tracking-tight">Your profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Set a daily goal and we'll track what's left on Discover as you log dishes.
        </p>
      </div>

      <section className="mt-6 max-w-md rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold tracking-tight">Daily goal</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {GOALS.map((g) => {
            const active = profile.goal === g;
            return (
              <button
                key={g}
                onClick={() => setGoal(g)}
                aria-pressed={active}
                className={`rounded-full px-2 py-2.5 text-sm font-medium transition active:scale-[0.98] ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {GOAL_LABEL[g]}
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Calories</label>
            <span className="text-sm font-semibold tabular-nums text-primary">
              {profile.calorieTarget} kcal
            </span>
          </div>
          <div className="mt-2">
            <Slider
              min={CALORIE_TARGET_MIN}
              max={CALORIE_TARGET_MAX}
              step={CALORIE_TARGET_STEP}
              value={[profile.calorieTarget]}
              onValueChange={([v]) => setCalorieTarget(v)}
              aria-label="Daily calorie target"
            />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold">Protein</label>
            <span className="text-sm font-semibold tabular-nums text-primary">
              {profile.proteinTarget} g
            </span>
          </div>
          <div className="mt-2">
            <Slider
              min={PROTEIN_TARGET_MIN}
              max={PROTEIN_TARGET_MAX}
              step={PROTEIN_TARGET_STEP}
              value={[profile.proteinTarget]}
              onValueChange={([v]) => setProteinTarget(v)}
              aria-label="Daily protein target"
            />
          </div>
        </div>

        <p className="mt-4 inline-flex items-start gap-1.5 text-[11px] text-muted-foreground">
          <Info className="mt-[1px] h-3.5 w-3.5 flex-none" />
          General starting points, not medical advice — adjust to whatever works for you.
        </p>
      </section>

      <section className="mt-4 max-w-md rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="text-sm font-bold tracking-tight">Dietary preference</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {DIETARY_OPTIONS.map(({ key, label }) => {
            const active = profile.dietaryPreference === key;
            return (
              <button
                key={key}
                onClick={() => setDietaryPreference(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition active:scale-[0.98] ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-accent"
                }`}
              >
                {active && <Check className="h-3.5 w-3.5" />}
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <p className="mt-4 max-w-md text-sm text-muted-foreground">
        Saved on this device only — no account needed. Location-aware discovery is still coming;{" "}
        <Link to="/" className="font-medium text-primary underline">
          join the waitlist on Discover
        </Link>{" "}
        to hear when it lands.
      </p>

      <BottomNav active="profile" />
    </main>
  );
}
