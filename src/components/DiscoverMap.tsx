import { useEffect, useRef } from "react";
import { LocateFixed } from "lucide-react";
import type { Restaurant } from "@/lib/fuelo-types";

type Props = {
  restaurants: Restaurant[];
  center: [number, number];
  userLocation?: [number, number] | null;
  onSelect: (r: Restaurant) => void;
  activeId?: string | null;
};

const PIN_SVG = (active: boolean) => `
<svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M16 0C7.716 0 1 6.716 1 15c0 10.5 13 23.5 14.05 24.55a1.34 1.34 0 0 0 1.9 0C18 38.5 31 25.5 31 15 31 6.716 24.284 0 16 0z" fill="#16a34a"/>
  ${active ? '<path d="M16 0C7.716 0 1 6.716 1 15c0 10.5 13 23.5 14.05 24.55a1.34 1.34 0 0 0 1.9 0C18 38.5 31 25.5 31 15 31 6.716 24.284 0 16 0z" fill="none" stroke="#ffffff" stroke-width="3"/>' : ""}
  <g transform="translate(16 15)" fill="#ffffff">
    <path d="M-4.2 -5.5 v4.2 M-2.4 -5.5 v4.2 M-0.6 -5.5 v4.2 M-4.2 -1.3 h3.6 a0.9 0.9 0 0 0 0.9 -0.9 v-3.3 M-2.4 -1.3 v6.8 M3.6 -5.5 c1.4 0 2.4 1.6 2.4 3.6 0 1.4 -0.7 2.6 -1.6 3.1 v4.1" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round" fill="none"/>
  </g>
</svg>`;

export default function DiscoverMap({
  restaurants,
  center,
  userLocation,
  onSelect,
  activeId,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const userMarkerRef = useRef<any>(null);
  const LRef = useRef<any>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const fitDoneRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const makeIcon = (L: any, active: boolean) => {
    const size = active ? [40, 50] : [32, 40];
    return L.divIcon({
      className: `fuelo-pin-wrap`,
      html: `<div class="fuelo-pin${active ? " fuelo-pin-active" : ""}">${PIN_SVG(active)}</div>`,
      iconSize: size as [number, number],
      iconAnchor: [size[0] / 2, size[1]],
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      const map = L.map(containerRef.current, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap contributors © CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;

      renderMarkers();

      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 250);

      // Redraw whenever the container's box actually changes size. This is the
      // reliable fix for the map rendering blank until a manual resize: it
      // covers the container settling to its real height after the desktop
      // layout mounts, remounting when switching back to Map view, and any
      // size change that isn't a window-level "resize" event.
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        let roRaf = 0;
        const ro = new ResizeObserver(() => {
          cancelAnimationFrame(roRaf);
          roRaf = requestAnimationFrame(() => mapRef.current?.invalidateSize());
        });
        ro.observe(containerRef.current);
        roRef.current = ro;
      }
    })();

    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      roRef.current?.disconnect();
      roRef.current = null;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        userMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMarkers = () => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};
    restaurants.forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const marker = L.marker([r.latitude, r.longitude], {
        icon: makeIcon(L, r.id === activeIdRef.current),
      }).addTo(map);
      marker.on("click", () => onSelectRef.current(r));
      markersRef.current[r.id] = marker;
    });
  };

  // Sync restaurant markers when list changes.
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants]);

  // Update view when center changes.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center[0], center[1]]);

  // Auto-fit bounds once user location + restaurants are known.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || fitDoneRef.current) return;
    const pts: [number, number][] = restaurants
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => [r.latitude as number, r.longitude as number]);
    if (userLocation) pts.push(userLocation);
    if (pts.length < 2) return;
    map.fitBounds(pts, { padding: [48, 48], maxZoom: 15 });
    fitDoneRef.current = true;
  }, [restaurants, userLocation]);

  // User location marker.
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    if (!userLocation) {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      return;
    }
    const icon = L.divIcon({
      className: "fuelo-user-dot-wrap",
      html: `<span class="fuelo-user-dot"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    if (!userMarkerRef.current) {
      userMarkerRef.current = L.marker(userLocation, {
        icon,
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    } else {
      userMarkerRef.current.setLatLng(userLocation);
    }
  }, [userLocation?.[0], userLocation?.[1]]);

  // Focus / restyle active marker.
  useEffect(() => {
    const L = LRef.current;
    if (!L) return;
    Object.entries(markersRef.current).forEach(([id, m]: [string, any]) => {
      m.setIcon(makeIcon(L, id === activeId));
    });
    if (!mapRef.current || !activeId) return;
    const m = markersRef.current[activeId];
    if (m) {
      const ll = m.getLatLng();
      mapRef.current.setView([ll.lat, ll.lng], Math.max(mapRef.current.getZoom(), 15), {
        animate: true,
      });
    }
  }, [activeId]);

  const recenter = () => {
    if (!mapRef.current || !userLocation) return;
    mapRef.current.setView(userLocation, Math.max(mapRef.current.getZoom(), 15), {
      animate: true,
    });
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {userLocation && (
        <button
          onClick={recenter}
          aria-label="Recenter on my location"
          className="absolute bottom-24 right-3 z-[400] h-11 w-11 rounded-full bg-card shadow-[var(--shadow-float)] flex items-center justify-center hover:bg-accent transition"
        >
          <LocateFixed className="h-5 w-5 text-primary" />
        </button>
      )}
    </div>
  );
}
