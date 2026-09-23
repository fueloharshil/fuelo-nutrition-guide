import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

// Shared across the whole app (not just Discover) so a location set on one
// page — live GPS or a manually searched place (see LocationPicker) —
// carries over anywhere else that cares how far away things are, e.g. the
// restaurant page's "X min walk" badge. Session-only, like
// Filters/Compare — not persisted to localStorage, since a browsing
// location is a transient choice, not a durable preference.
export type ManualLocation = { lat: number; lng: number; label: string };

type Ctx = {
  gpsLocation: [number, number] | null;
  setGpsLocation: (loc: [number, number] | null) => void;
  manualLocation: ManualLocation | null;
  setManualLocation: (loc: ManualLocation | null) => void;
  /** manualLocation if set, else gpsLocation — the one location value
   *  everything else (map centering, travel-time filter, per-restaurant
   *  walk time) should actually use. */
  effectiveLocation: [number, number] | null;
};

const LocationCtx = createContext<Ctx | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [gpsLocation, setGpsLocation] = useState<[number, number] | null>(null);
  const [manualLocation, setManualLocation] = useState<ManualLocation | null>(null);

  const effectiveLocation = useMemo<[number, number] | null>(
    () => (manualLocation ? [manualLocation.lat, manualLocation.lng] : gpsLocation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manualLocation?.lat, manualLocation?.lng, gpsLocation?.[0], gpsLocation?.[1]],
  );

  const value: Ctx = {
    gpsLocation,
    setGpsLocation,
    manualLocation,
    setManualLocation,
    effectiveLocation,
  };

  return <LocationCtx.Provider value={value}>{children}</LocationCtx.Provider>;
}

export function useLocationContext() {
  const ctx = useContext(LocationCtx);
  if (!ctx) throw new Error("useLocationContext must be used inside LocationProvider");
  return ctx;
}
