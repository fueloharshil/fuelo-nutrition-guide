// "Get Directions" opens the map app the device actually has installed:
// Apple Maps on iOS/macOS (Safari/Chrome there both hand off to it fine from
// a plain https:// link — no custom URL scheme needed), Google Maps
// everywhere else. Detection only matters client-side, so this is only ever
// called from a click handler, never rendered as a static SSR'd href.
export function buildDirectionsUrl(lat: number, lng: number, label?: string): string {
  const isApple =
    typeof navigator !== "undefined" && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);
  if (isApple) {
    const query = label ? `&q=${encodeURIComponent(label)}` : "";
    return `https://maps.apple.com/?daddr=${lat},${lng}${query}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
