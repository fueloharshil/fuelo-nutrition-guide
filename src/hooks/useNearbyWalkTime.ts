import { useEffect, useState } from "react";
import { useLocationContext } from "@/components/LocationProvider";
import { fetchTravelTimes } from "@/lib/travelTimes";
import { NEARBY_WALK_MINUTES } from "@/lib/filters";

/** Real walking minutes from the effective location (GPS or a searched
 *  place — see LocationProvider) to one restaurant, or null if unknown OR
 *  further than NEARBY_WALK_MINUTES — i.e. "don't show this, it's not a
 *  realistic walk," baked in here so every caller doesn't re-check the
 *  threshold itself. One Matrix request per restaurant shown (via
 *  fetchTravelTimes, same helper Discover's bulk travel-time filter uses,
 *  just called with a single destination) — fine for a single card or page,
 *  not meant for fetching many restaurants' times at once. */
export function useNearbyWalkTime(
  id: string | null,
  lat: number | null | undefined,
  lng: number | null | undefined,
): number | null {
  const { effectiveLocation } = useLocationContext();
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    setMinutes(null);
    if (!effectiveLocation || !id || lat == null || lng == null) return;
    let cancelled = false;
    fetchTravelTimes(
      { lat: effectiveLocation[0], lng: effectiveLocation[1] },
      [{ id, lat, lng }],
      "walking",
    ).then((result) => {
      if (cancelled) return;
      const mins = result?.get(id)?.minutes ?? null;
      setMinutes(mins != null && mins <= NEARBY_WALK_MINUTES ? mins : null);
    });
    return () => {
      cancelled = true;
    };
  }, [effectiveLocation, id, lat, lng]);

  return minutes;
}
