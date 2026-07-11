import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Ctx = {
  saved: string[];
  toggle: (id: string) => void;
  isSaved: (id: string) => boolean;
};
const SavedCtx = createContext<Ctx | null>(null);
const KEY = "fuelo:saved";

export function SavedProvider({ children }: { children: ReactNode }) {
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {}
  }, [saved]);
  return (
    <SavedCtx.Provider
      value={{
        saved,
        isSaved: (id) => saved.includes(id),
        toggle: (id) =>
          setSaved((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])),
      }}
    >
      {children}
    </SavedCtx.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedCtx);
  if (!ctx) throw new Error("useSaved must be used inside SavedProvider");
  return ctx;
}
