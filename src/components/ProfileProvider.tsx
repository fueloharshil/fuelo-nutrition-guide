import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_PROFILE,
  GOAL_DEFAULTS,
  type DietaryPreference,
  type Goal,
  type Profile,
} from "@/lib/profile";

export const PROFILE_KEY = "fuelo:profile";

type Ctx = {
  profile: Profile;
  hasGoal: boolean;
  setGoal: (goal: Goal) => void;
  setCalorieTarget: (n: number) => void;
  setProteinTarget: (n: number) => void;
  setDietaryPreference: (p: DietaryPreference) => void;
};

const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);

  useEffect(() => {
    try {
      const rawProfile = localStorage.getItem(PROFILE_KEY);
      if (rawProfile) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(rawProfile) });
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
  }, [profile]);

  const value: Ctx = {
    profile,
    hasGoal: profile.goal != null,
    setGoal: (goal) =>
      setProfile((cur) => ({
        ...cur,
        goal,
        calorieTarget: GOAL_DEFAULTS[goal].calories,
        proteinTarget: GOAL_DEFAULTS[goal].protein,
      })),
    setCalorieTarget: (n) => setProfile((cur) => ({ ...cur, calorieTarget: n })),
    setProteinTarget: (n) => setProfile((cur) => ({ ...cur, proteinTarget: n })),
    setDietaryPreference: (p) => setProfile((cur) => ({ ...cur, dietaryPreference: p })),
  };

  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
