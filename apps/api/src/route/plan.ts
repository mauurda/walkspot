/**
 * plan.ts — which order to walk the stops in. Pure.
 *
 * Nearest-neighbour from the start, then 2-opt until no swap shortens the
 * walk. For the dozen-odd stops a hunt has, this is optimal or within a few
 * percent of it, and it runs in microseconds. Distances are as the crow
 * flies; the street geometry comes afterwards (osrm.ts) and only draws the
 * order this chose.
 */
import { distanceM, type Point } from "../geo.js";

/** Metres per second a group actually walks, stopping for photos. */
export const WALK_MPS = 1.2;

/** Returns stop indices in visiting order. Open path: it does not return to the start. */
export function orderStops(start: Point | null, stops: Point[]): number[] {
  if (stops.length < 2) return stops.map((_, i) => i);

  const n = stops.length;
  const d = (a: number, b: number) => distanceM(stops[a]!, stops[b]!);

  // Nearest neighbour.
  const remaining = new Set(stops.map((_, i) => i));
  let order: number[] = [];
  let current: number;
  if (start) {
    current = nearest(start, [...remaining]);
  } else {
    current = 0;
  }
  order.push(current);
  remaining.delete(current);
  while (remaining.size) {
    const next = nearest(stops[current]!, [...remaining]);
    order.push(next);
    remaining.delete(next);
    current = next;
  }

  // 2-opt on the open path. The first stop is fixed only when a start exists.
  const cost = (o: number[]) => {
    let sum = start ? distanceM(start, stops[o[0]!]!) : 0;
    for (let i = 1; i < o.length; i++) sum += d(o[i - 1]!, o[i]!);
    return sum;
  };
  let best = cost(order);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const candidate = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)];
        const c = cost(candidate);
        if (c + 1e-6 < best) {
          order = candidate;
          best = c;
          improved = true;
        }
      }
    }
  }
  return order;

  function nearest(from: Point, candidates: number[]): number {
    let bestIdx = candidates[0]!;
    let bestDist = Infinity;
    for (const i of candidates) {
      const dist = distanceM(from, stops[i]!);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    return bestIdx;
  }
}

export type Leg = { distance_m: number; duration_s: number };

/** Straight-line legs between consecutive points, as the fallback when no router answers. */
export function straightLegs(points: Point[]): Leg[] {
  const legs: Leg[] = [];
  for (let i = 1; i < points.length; i++) {
    const distance_m = Math.round(distanceM(points[i - 1]!, points[i]!));
    legs.push({ distance_m, duration_s: Math.round(distance_m / WALK_MPS) });
  }
  return legs;
}
