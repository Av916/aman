"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export type MapPoint = {
  latitude: number;
  longitude: number;
  name: string;
  href?: string;
};

export function VenueMap({
  points,
  onPick,
}: {
  points: MapPoint[];
  onPick?: (latitude: number, longitude: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let map: import("leaflet").Map | undefined;
    let disposed = false;
    void import("leaflet")
      .then((L) => {
        if (disposed) return;
        const first = points[0];
        map = L.map(element, { scrollWheelZoom: false }).setView(
          first ? [first.latitude, first.longitude] : [22.4, 78.9],
          first ? 13 : 5,
        );
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
        for (const point of points) {
          const content = document.createElement(point.href ? "a" : "span");
          content.textContent = point.name;
          if (content instanceof HTMLAnchorElement && point.href)
            content.href = point.href;
          L.circleMarker([point.latitude, point.longitude], {
            color: "var(--palette-forest)",
            fillColor: "var(--palette-sand)",
            fillOpacity: 0.95,
            radius: 9,
          })
            .bindPopup(content)
            .addTo(map);
        }
        if (points.length > 1)
          map.fitBounds(
            L.latLngBounds(
              points.map((point) => [point.latitude, point.longitude]),
            ),
            { padding: [35, 35], maxZoom: 14 },
          );
        if (onPick)
          map.on("click", ({ latlng }) =>
            onPick(
              Number(latlng.lat.toFixed(6)),
              Number(latlng.lng.toFixed(6)),
            ),
          );
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      map?.remove();
    };
  }, [points, onPick]);
  return failed ? (
    <p role="status">The map is temporarily unavailable.</p>
  ) : (
    <div
      ref={host}
      role="region"
      aria-label={onPick ? "Select map location" : "Venue map"}
      className="z-0 h-72 w-full rounded-xl bg-highlight md:h-96"
    />
  );
}
