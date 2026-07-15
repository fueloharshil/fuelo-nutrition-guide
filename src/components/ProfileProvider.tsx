import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  DEFAULT_PROFILE,
  GOAL_DEFAULTS,
  emptyDailyLog,
  todayKey,
  type DailyLog,
  type DietaryPreference,
  type Goal,
  type Profile,
} from "@/lib/profile";

const PROFILE_KEY = "fuelo:profile";
const LOG_KEY = "fuelo:daily-log";

type LoggedDish = { id: string; calories: number; protein: number };

type Ctx = {
  profile: Profile;
  hasGoal: boolean;
  setGoal: (goal: Goal) => void;
  setCalorieTarget: (n: number) => void;
  setProteinTarget: (n: number) => void;
  setDietaryPreference: (p: DietaryPreference) => void;
  dailyLog: DailyLog;
  remainingCalories: number;
  remainingProtein: number;
  isDishLogged: (dishId: string) => boolean;
  toggleLogDish: (dish: LoggedDish) => void;
};

const ProfileCtx = createContext<Ctx | null>(null);

/** Rolls the log over to a fresh, empty day if the stored date isn't today. */
function withFreshDay(log: DailyLog): DailyLog {
  return log.date === todayKey() ? log : emptyDailyLog();
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [dailyLog, setDailyLog] = useState<DailyLog>(emptyDailyLog());

  useEffect(() => {
    try {
      const rawProfile = localStorage.getItem(PROFILE_KEY);
      if (rawProfile) setProfile({ ...DEFAULT_PROFILE, ...JSON.parse(rawProfile) });
      const rawLog = localStorage.getItem(LOG_KEY);
      if (rawLog) setDailyLog(withFreshDay(JSON.parse(rawLog)));
    } catch {}

    // Reset the log if the day rolls over while the app stays open.
    const interval = setInterval(() => {
      setDailyLog((cur) => withFreshDay(cur));
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    } catch {}
  }, [profile]);

  useEffect(() => {
    try {
      localStorage.setItem(LOG_KEY, JSON.stringify(dailyLog));
    } catch {}
  }, [dailyLog]);

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
    dailyLog,
    remainingCalories: profile.calorieTarget - dailyLog.loggedCalories,
    remainingProtein: profile.proteinTarget - dailyLog.loggedProtein,
    isDishLogged: (dishId) => dailyLog.loggedDishIds.includes(dishId),
    toggleLogDish: (dish) =>
      setDailyLog((cur) => {
        const fresh = withFreshDay(cur);
        const already = fresh.loggedDishIds.includes(dish.id);
        return already
          ? {
              ...fresh,
              loggedCalories: Math.max(0, fresh.loggedCalories - dish.calories),
              loggedProtein: Math.max(0, fresh.loggedProtein - dish.protein),
              loggedDishIds: fresh.loggedDishIds.filter((id) => id !== dish.id),
            }
          : {
              ...fresh,
              loggedCalories: fresh.loggedCalories + dish.calories,
              loggedProtein: fresh.loggedProtein + dish.protein,
              loggedDishIds: [...fresh.loggedDishIds, dish.id],
            };
      }),
  };

  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileCtx);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
