/**
 * osrm.ts — street geometry for an order plan.ts already chose. Any
 * OSRM-compatible server (ROUTING_URL); null on any failure so the caller
 * falls back to straight lines rather than to no route.
 */
import type { Point } from "../geo";
import type { Leg } from "./plan";

export type Geometry = { coordinates: [number, number][]; legs: Leg[] };

const TIMEOUT_MS = 6000;

export async function fetchGeometry(baseUrl: string, points: Point[]): Promise<Geometry | null> {
  if (!baseUrl || points.length < 2) return null;
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(";");
  const url = `${baseUrl}/route/v1/foot/${coords}?overview=full&geometries=geojson&steps=false`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "walkspot" } });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code?: string;
      routes?: { geometry: { coordinates: [number, number][] }; legs: { distance: number; duration: number }[] }[];
    };
    const route = body.routes?.[0];
    if (body.code !== "Ok" || !route) return null;
    return {
      // GeoJSON is [lng, lat]; the client (Leaflet) wants [lat, lng].
      coordinates: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      legs: route.legs.map((l) => ({ distance_m: Math.round(l.distance), duration_s: Math.round(l.duration) })),
    };
  } catch {
    return null;
  }
}
