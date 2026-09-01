/**
 * geo.ts — the phone's position, on request, with the accuracy so a screen
 * can decide whether to trust it. Also the one haversine the client needs
 * for "how far is that from me".
 */
import { useCallback, useState } from "react";

export type Fix = { lat: number; lng: number; accuracy_m: number; at: number };

export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

export function locate(): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("This browser has no location"));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy_m: pos.coords.accuracy, at: Date.now() }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? "Location permission was denied" : "Couldn't get a location fix")),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 15_000 },
    );
  });
}

export function useLocation() {
  const [fix, setFix] = useState<Fix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const next = await locate();
      setFix(next);
      setError(null);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Location unavailable");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);
  return { fix, error, busy, refresh };
}
