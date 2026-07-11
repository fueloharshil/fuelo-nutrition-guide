import { useEffect, useRef } from "react";
import type { Restaurant } from "@/lib/fuelo-types";

type Props = {
  restaurants: Restaurant[];
  center: [number, number];
  userLocation?: [number, number] | null;
  onSelect: (r: Restaurant) => void;
  activeId?: string | null;
};

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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;
      LRef.current = L;

      // Fix default marker icon paths (CDN so no bundler shenanigans).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

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

      restaurants.forEach((r) => {
        if (r.latitude == null || r.longitude == null) return;
        const marker = L.marker([r.latitude, r.longitude]).addTo(map);
        marker.on("click", () => onSelectRef.current(r));
        markersRef.current[r.id] = marker;
      });

      // Redraw once mounted, and again after layout settles.
      requestAnimationFrame(() => map.invalidateSize());
      setTimeout(() => map.invalidateSize(), 250);
    })();

    // Also invalidate on window resize.
    const onResize = () => mapRef.current?.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", onResize);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
        userMarkerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync restaurant markers when list changes (e.g., after filtering).
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L) return;
    Object.values(markersRef.current).forEach((m: any) => m.remove());
    markersRef.current = {};
    restaurants.forEach((r) => {
      if (r.latitude == null || r.longitude == null) return;
      const marker = L.marker([r.latitude, r.longitude]).addTo(map);
      marker.on("click", () => onSelectRef.current(r));
      markersRef.current[r.id] = marker;
    });
  }, [restaurants]);

  // Update view when center changes.
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, mapRef.current.getZoom());
    }
  }, [center[0], center[1]]);

  // User location marker (distinct blue dot).
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

  // Focus active marker.
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
