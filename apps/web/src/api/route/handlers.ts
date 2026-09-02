/**
 * route/handlers.ts — "which way makes sense". Given where a participant is
 * and which located challenges they still want, return an order, the legs,
 * and a line to draw.
 */
import { env } from "../env";
import { AppError } from "../errors";
import { eventRoute, json } from "../http";
import type { Point } from "../geo";
import { listChallenges } from "../challenges/handlers";
import { progressFor } from "../submissions/scoring";
import { loadScoring } from "../submissions/load";
import { fetchGeometry } from "./osrm";
import { orderStops, straightLegs } from "./plan";

function point(value: unknown): Point | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// POST /route { from?: {lat,lng}, challenge_ids?: string[], keep_order?: boolean }
//   challenge_ids omitted → every located challenge the caller hasn't finished.
//   keep_order → draw the given order instead of optimizing it.
export const planRoute = eventRoute("anyone", async ({ event, participant, body }) => {
  const from = point(body.from);
  const keepOrder = body.keep_order === true;
  const wanted: unknown = body.challenge_ids;

  let challenges = (await listChallenges(event.id)).filter((c) => c.lat != null && c.lng != null);
  if (Array.isArray(wanted)) {
    const ids = wanted.filter((id): id is string => typeof id === "string");
    const idSet = new Set(ids);
    challenges = challenges.filter((c) => idSet.has(c.id));
    if (keepOrder) challenges.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  } else if (participant) {
    const scoring = await loadScoring(event);
    challenges = challenges.filter((c) => progressFor(scoring, participant.id, c.id).status !== "approved");
  }
  if (!challenges.length) throw new AppError("No located challenges to route between", 400, "NO_STOPS");

  const stops = challenges.map((c) => ({ lat: c.lat!, lng: c.lng! }));
  const order = keepOrder ? stops.map((_, i) => i) : orderStops(from, stops);
  const ordered = order.map((i) => challenges[i]!);
  const points: Point[] = [...(from ? [from] : []), ...ordered.map((c) => ({ lat: c.lat!, lng: c.lng! }))];

  const geometry = await fetchGeometry(env.routingUrl, points);
  const legs = geometry?.legs ?? straightLegs(points);
  const coordinates = geometry?.coordinates ?? points.map((p) => [p.lat, p.lng] as [number, number]);

  return json({
    from,
    stops: ordered.map((c) => ({ id: c.id, title: c.title, points: c.points, lat: c.lat, lng: c.lng })),
    legs,
    coordinates,
    total: {
      distance_m: legs.reduce((s, l) => s + l.distance_m, 0),
      duration_s: legs.reduce((s, l) => s + l.duration_s, 0),
    },
    source: geometry ? "streets" : "straight",
  });
});
