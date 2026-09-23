// Address/place search backing the "Set location" picker (see
// LocationPicker.tsx) — lets a user browse Discover from anywhere, not just
// wherever their device's GPS says they are. Uses Mapbox's Geocoding API
// (forward search), same VITE_MAPBOX_TOKEN as the map and travel-time
// filter. Pure REST (fetch), no mapbox-gl import needed.
//
// https://docs.mapbox.com/api/search/geocoding/

export type GeocodeResult = {
  id: string;
  label: string;
  lat: number;
  lng: number;
};

type GeocodeFeature = {
  id?: string;
  geometry: { coordinates: [number, number] };
  properties?: { full_address?: string; name?: string; place_formatted?: string };
};

/** Searches for places matching `query`. Returns [] for a too-short query
 *  (nothing worth searching yet), or null if the request itself failed (no
 *  token, network error) so callers can degrade gracefully. */
export async function searchPlaces(query: string): Promise<GeocodeResult[] | null> {
  const q = query.trim();
  if (q.length < 3) return [];

  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&limit=5&access_token=${token}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[geocoding] Mapbox forward geocode returned ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { features?: GeocodeFeature[] };
    return (body.features ?? []).map((f, i) => ({
      id: f.id ?? String(i),
      label: f.properties?.full_address ?? f.properties?.name ?? f.properties?.place_formatted ?? q,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }));
  } catch (err) {
    console.warn("[geocoding] search failed:", (err as Error).message);
    return null;
  }
}
