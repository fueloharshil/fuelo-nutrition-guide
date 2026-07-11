import { useEffect, useRef } from "react";
import type { Restaurant } from "@/lib/fuelo-types";

type Props = {
  restaurants: Restaurant[];
  center: [number, number];
  onSelect: (r: Restaurant) => void;
  activeId?: string | null;
};

export default function DiscoverMap({ restaurants, center, onSelect, activeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current) return;
      if (mapRef.current) return;

      const map = L.map(containerRef.current, {
        center,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      mapRef.current = map;

      // Add markers
      restaurants.forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;
        const icon = L.divIcon({
          className: "",
          html: `<div class="fuelo-pin">${escapeHtml(r.name)}</div>`,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });
        const marker = L.marker([r.latitude, r.longitude], { icon }).addTo(map);
        marker.on("click", () => onSelectRef.current(r));
        markersRef.current[r.id] = marker;
      });
    })();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center when it changes (e.g., geolocation resolved)
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center[0], center[1]]);

  // Highlight active
  useEffect(() => {
    if (!mapRef.current || !activeId) return;
    const m = markersRef.current[activeId];
    if (m) {
      const ll = m.getLatLng();
      mapRef.current.setView([ll.lat, ll.lng], Math.max(mapRef.current.getZoom(), 15), {
        animate: true,
      });
    }
  }, [activeId]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
