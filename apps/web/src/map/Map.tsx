"use client";
/**
 * Map — one Leaflet wrapper for every map in the app: numbered pins for
 * challenges, a dot for "you", a line for the route, and an optional
 * click-to-place for the organizer's editor. Markers are divIcons so no
 * image assets need to survive the bundler.
 */
import L from "leaflet";
import { useEffect } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";

export type Pin = { id: string; lat: number; lng: number; label: string; title?: string; tone?: "brand" | "done" | "off" };

function pinIcon(label: string, tone: Pin["tone"]) {
  return L.divIcon({ className: "", html: `<div class="ws-pin ${tone ?? ""}">${label}</div>`, iconSize: [30, 30], iconAnchor: [15, 15] });
}
const ME_ICON = L.divIcon({ className: "", html: `<div class="ws-pin me"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });

function Fit({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) map.setView(points[0]!, 16);
    else map.fitBounds(L.latLngBounds(points), { padding: [32, 32] });
    // Fit once per distinct set of points, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points.map((p) => p.join(",")).join(";")]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (p: { lat: number; lng: number }) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export function Map({
  pins,
  me,
  line,
  dashed,
  onPick,
  className,
  fitTo,
}: {
  pins: Pin[];
  me?: { lat: number; lng: number } | null;
  line?: [number, number][];
  dashed?: boolean;
  onPick?: (p: { lat: number; lng: number }) => void;
  className?: string;
  /** Which points decide the initial view; defaults to pins + me. */
  fitTo?: [number, number][];
}) {
  const points: [number, number][] = fitTo ?? [...pins.map((p) => [p.lat, p.lng] as [number, number]), ...(me ? [[me.lat, me.lng] as [number, number]] : [])];
  return (
    <MapContainer center={points[0] ?? [20, 0]} zoom={points.length ? 15 : 2} className={className ?? "h-72 w-full rounded-lg"} scrollWheelZoom>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit points={points} />
      {onPick ? <ClickToPlace onPick={onPick} /> : null}
      {line && line.length > 1 ? <Polyline positions={line} pathOptions={{ color: "#1f5f5b", weight: 5, opacity: 0.85, dashArray: dashed ? "8 10" : undefined }} /> : null}
      {pins.map((p) => (
        <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(p.label, p.tone)}>
          {p.title ? <Popup>{p.title}</Popup> : null}
        </Marker>
      ))}
      {me ? <Marker position={[me.lat, me.lng]} icon={ME_ICON} zIndexOffset={1000} /> : null}
    </MapContainer>
  );
}
