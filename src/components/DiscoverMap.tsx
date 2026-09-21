import { useEffect, useRef } from "react";
import { LocateFixed } from "lucide-react";
import type { Restaurant } from "@/lib/fuelo-types";
import { BADGE_LABEL, type BadgeType } from "@/lib/discoverBadges";

type Props = {
  restaurants: Restaurant[];
  center: [number, number];
  userLocation?: [number, number] | null;
  onSelect: (r: Restaurant) => void;
  activeId?: string | null;
  badges?: Record<string, BadgeType | null>;
};

// mapbox-gl touches `window`/WebGL at import time, so (like the previous
// Leaflet setup) it's loaded dynamically inside an effect rather than at
// module scope, keeping this SSR-safe. These are type-only aliases derived
// from the package's own types — no runtime import here.
type MapboxGLModule = typeof import("mapbox-gl").default;
type MapboxMap = InstanceType<MapboxGLModule["Map"]>;
type MapboxMarker = InstanceType<MapboxGLModule["Marker"]>;

// The Fuelo Ring mark: a small circular pin matching the logo icon and the
// in-app confidence ring (see ConfidenceRing.tsx / public/fuelo-wordmark.svg)
// — a solid green circle with a white partial ring (arc, not closed) and a
// white dot at the arc's edge, rather than a teardrop map-pin shape. The
// active variant adds a white outer halo ring and scales up.
const RING_SVG = (active: boolean) => {
  const R = active ? 13 : 11; // main green circle radius
  const ringR = R * (7 / 11); // inner white arc radius, proportional to R
  const ringStroke = active ? 3.1 : 2.6;
  const circumference = 2 * Math.PI * ringR;
  // Same ~75%/25% dash/gap ratio as the logo's ring (dasharray 104 34 on r=22).
  const dash = (circumference * 104) / 138.2;
  const gap = (circumference * 34) / 138.2;
  const dotR = active ? 2.1 : 1.75;
  const angleRad = (-40 * Math.PI) / 180; // same arc-edge angle as the logo mark
  const dotX = 20 + ringR * Math.cos(angleRad);
  const dotY = 20 + ringR * Math.sin(angleRad);
  return `
<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  ${active ? '<circle cx="20" cy="20" r="17" fill="none" stroke="#ffffff" stroke-width="3"/>' : ""}
  <circle cx="20" cy="20" r="${R}" fill="#16a34a"/>
  <circle cx="20" cy="20" r="${ringR.toFixed(2)}" fill="none" stroke="#ffffff" stroke-width="${ringStroke}" stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${gap.toFixed(2)}" transform="rotate(-52 20 20)"/>
  <circle cx="${dotX.toFixed(2)}" cy="${dotY.toFixed(2)}" r="${dotR}" fill="#ffffff"/>
</svg>`;
};

// Hides every label/icon layer so the basemap reads as clean and
// decluttered — the Mapbox-style equivalent of CARTO's old "light_nolabels"
// tiles. `visibility` is a universal layout property, so this is safe to
// apply to any layer.
function declutterStyle(map: MapboxMap) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type === "symbol") {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
}

export default function DiscoverMap({
  restaurants,
  center,
  userLocation,
  onSelect,
  activeId,
  badges,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapboxglRef = useRef<MapboxGLModule | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<Record<string, MapboxMarker>>({});
  const userMarkerRef = useRef<MapboxMarker | null>(null);
  const roRef = useRef<ResizeObserver | null>(null);
  const fitDoneRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const badgesRef = useRef(badges);
  badgesRef.current = badges;

  const makeEl = (active: boolean, badge: BadgeType | null | undefined) => {
    const size = active ? 44 : 30;
    const badgeHtml = badge
      ? `<span class="fuelo-ring-badge">${BADGE_LABEL[badge]}</span>`
      : "";
    const wrap = document.createElement("div");
    wrap.className = "fuelo-ring-wrap";
    wrap.style.width = `${size}px`;
    wrap.style.height = `${size}px`;
    wrap.innerHTML = `<div class="fuelo-ring-pin${active ? " fuelo-ring-pin-active" : ""}">${RING_SVG(active)}${badgeHtml}</div>`;
    return wrap;
  };

  const renderMarkers = () => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;
    Object.values(markersRef.current).forEach((m) => m.remove());
    markersRef.current = {};
    restaurants.forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const isActive = r.id === activeIdRef.current;
      const el = makeEl(isActive, badgesRef.current?.[r.id]);
      el.addEventListener("click", () => onSelectRef.current(r));
      const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([r.longitude, r.latitude])
        .addTo(map);
      markersRef.current[r.id] = marker;
    });
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      mapboxglRef.current = mapboxgl;

      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN ?? "";

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: [center[1], center[0]],
        zoom: 14,
        attributionControl: true,
      });
      map.on("style.load", () => declutterStyle(map));
      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;

      map.on("load", () => {
        renderMarkers();
        map.resize();
      });

      // Redraw whenever the container's box actually changes size — covers
      // the container settling to its real height after the desktop layout
      // mounts, remounting when switching back to Map view, and any size
      // change that isn't a window-level "resize" event.
      if (typeof ResizeObserver !== "undefined" && containerRef.current) {
        let roRaf = 0;
        const ro = new ResizeObserver(() => {
          cancelAnimationFrame(roRaf);
          roRaf = requestAnimationFrame(() => mapRef.current?.resize());
        });
        ro.observe(containerRef.current);
        roRef.current = ro;
      }
    })();

    const onResize = () => mapRef.current?.resize();
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

  // Sync restaurant markers when the list or their badges change.
  useEffect(() => {
    if (mapRef.current?.loaded()) renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, badges]);

  // Update view when center changes.
  useEffect(() => {
    mapRef.current?.setCenter([center[1], center[0]]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1]]);

  // Auto-fit bounds once user location + restaurants are known.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl || fitDoneRef.current) return;
    const pts: [number, number][] = restaurants
      .filter((r) => r.latitude != null && r.longitude != null)
      .map((r) => [r.longitude as number, r.latitude as number]);
    if (userLocation) pts.push([userLocation[1], userLocation[0]]);
    if (pts.length < 2) return;
    const bounds = pts.reduce(
      (b, p) => b.extend(p),
      new mapboxgl.LngLatBounds(pts[0], pts[0]),
    );
    map.fitBounds(bounds, { padding: 48, maxZoom: 15 });
    fitDoneRef.current = true;
  }, [restaurants, userLocation]);

  // User location marker — a distinct blue dot, never styled like a restaurant pin.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;
    if (!userLocation) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (!userMarkerRef.current) {
      const el = document.createElement("div");
      el.className = "fuelo-user-dot-wrap";
      el.innerHTML = `<span class="fuelo-user-dot"></span>`;
      userMarkerRef.current = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat([userLocation[1], userLocation[0]])
        .addTo(map);
    } else {
      userMarkerRef.current.setLngLat([userLocation[1], userLocation[0]]);
    }
  }, [userLocation?.[0], userLocation?.[1]]);

  // Focus / restyle active marker.
  useEffect(() => {
    const map = mapRef.current;
    const mapboxgl = mapboxglRef.current;
    if (!map || !mapboxgl) return;
    Object.entries(markersRef.current).forEach(([id, marker]) => {
      const isActive = id === activeId;
      const lngLat = marker.getLngLat();
      marker.remove();
      const el = makeEl(isActive, badgesRef.current?.[id]);
      const r = restaurants.find((x) => x.id === id);
      if (r) el.addEventListener("click", () => onSelectRef.current(r));
      markersRef.current[id] = new mapboxgl.Marker({ element: el, anchor: "center" })
        .setLngLat(lngLat)
        .addTo(map);
    });
    if (!activeId) return;
    const m = markersRef.current[activeId];
    if (m) {
      map.easeTo({ center: m.getLngLat(), zoom: Math.max(map.getZoom(), 15) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map || !userLocation) return;
    map.easeTo({ center: [userLocation[1], userLocation[0]], zoom: Math.max(map.getZoom(), 15) });
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
