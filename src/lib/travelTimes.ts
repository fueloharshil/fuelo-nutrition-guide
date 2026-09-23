import type { TravelMode } from "@/lib/filters";

// Real walking/cycling/driving times via Mapbox's Matrix API — one request
// computes the origin-to-every-destination time in one go, rather than a
// separate Directions call per restaurant. Uses the same VITE_MAPBOX_TOKEN
// already set up for the map (see DiscoverMap.tsx / CLAUDE.md's "Mapbox
// setup"). Pure REST (fetch), no mapbox-gl import needed.
//
// https://docs.mapbox.com/api/navigation/matrix/

const MODE_PROFILE: Record<TravelMode, string> = {
  walking: "walking",
  cycling: "cycling",
  driving: "driving",
};

// Mapbox's Matrix API caps requests at 25 total coordinates (1 origin + up
// to 24 destinations), so a restaurant list beyond that is chunked into
// multiple requests and merged.
const MAX_DESTINATIONS_PER_REQUEST = 24;

export type TravelTimeResult = { minutes: number; km: number };

export type TravelDestination = { id: string; lat: number; lng: number };

/** Fetches real travel time/distance from `origin` to every destination for
 *  the given mode. Returns a Map keyed by destination id, or null if the
 *  request failed (missing/invalid token, network error, no scope) so
 *  callers can degrade gracefully — same pattern as the rest of this app's
 *  Mapbox/Supabase integrations. */
export async function fetchTravelTimes(
  origin: { lat: number; lng: number },
  destinations: TravelDestination[],
  mode: TravelMode,
): Promise<Map<string, TravelTimeResult> | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token || destinations.length === 0) return destinations.length === 0 ? new Map() : null;

  const chunks: TravelDestination[][] = [];
  for (let i = 0; i < destinations.length; i += MAX_DESTINATIONS_PER_REQUEST) {
    chunks.push(destinations.slice(i, i + MAX_DESTINATIONS_PER_REQUEST));
  }

  try {
    const chunkResults = await Promise.all(chunks.map((chunk) => fetchChunk(origin, chunk, mode, token)));
    const merged = new Map<string, TravelTimeResult>();
    for (const chunkMap of chunkResults) {
      if (!chunkMap) return null;
      for (const [id, result] of chunkMap) merged.set(id, result);
    }
    return merged;
  } catch (err) {
    console.warn("[travelTimes] Matrix request failed:", (err as Error).message);
    return null;
  }
}

async function fetchChunk(
  origin: { lat: number; lng: number },
  destinations: TravelDestination[],
  mode: TravelMode,
  token: string,
): Promise<Map<string, TravelTimeResult> | null> {
  const coords = [`${origin.lng},${origin.lat}`, ...destinations.map((d) => `${d.lng},${d.lat}`)].join(
    ";",
  );
  const url = `https://api.mapbox.com/directions-matrix/v1/mapbox/${MODE_PROFILE[mode]}/${coords}?sources=0&annotations=duration,distance&access_token=${token}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[travelTimes] Matrix API returned ${res.status}`);
    return null;
  }
  const body = (await res.json()) as {
    code: string;
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  if (body.code !== "Ok" || !body.durations || !body.distances) {
    console.warn("[travelTimes] Matrix API error code:", body.code);
    return null;
  }

  const durations = body.durations[0]; // single source (index 0) → one row
  const distances = body.distances[0];
  const map = new Map<string, TravelTimeResult>();
  destinations.forEach((dest, i) => {
    // Index 0 in each row is the origin itself; destination i is at i + 1.
    const seconds = durations[i + 1];
    const meters = distances[i + 1];
    if (seconds == null || meters == null) return; // unreachable by this mode
    map.set(dest.id, { minutes: Math.round(seconds / 60), km: Math.round((meters / 1000) * 10) / 10 });
  });
  return map;
}

/** Haversine distance in meters — used only to decide whether the user has
 *  moved far enough since the last Matrix fetch to warrant refetching. */
export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
