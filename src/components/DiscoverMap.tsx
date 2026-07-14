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

export default function DiscoverMap({
  restaurants,
  center,
  userLocation,
  onSelect,
  activeId,
  badges,
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
  const badgesRef = useRef(badges);
  badgesRef.current = badges;

  const makeIcon = (L: any, active: boolean, badge: BadgeType | null | undefined) => {
    const size = active ? 44 : 30;
    const badgeHtml = badge
      ? `<span class="fuelo-ring-badge">${BADGE_LABEL[badge]}</span>`
      : "";
    return L.divIcon({
      className: "fuelo-ring-wrap",
      html: `<div class="fuelo-ring-pin${active ? " fuelo-ring-pin-active" : ""}">${RING_SVG(active)}${badgeHtml}</div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
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
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
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
      const isActive = r.id === activeIdRef.current;
      const marker = L.marker([r.latitude, r.longitude], {
        icon: makeIcon(L, isActive, badgesRef.current?.[r.id]),
      }).addTo(map);
      marker.on("click", () => onSelectRef.current(r));
      markersRef.current[r.id] = marker;
    });
  };

  // Sync restaurant markers when the list or their badges change.
  useEffect(() => {
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurants, badges]);

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

  // User location marker — a distinct blue dot, never styled like a restaurant pin.
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
      m.setIcon(makeIcon(L, id === activeId, badgesRef.current?.[id]));
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
