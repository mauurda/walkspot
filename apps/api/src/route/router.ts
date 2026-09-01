/**
 * route/router.ts — "which way makes sense". Given where a participant is and
 * which located challenges they still want, return an order, the legs, and a
 * line to draw.
 */
import { Router } from "express";
import { env } from "../env.js";
import { AppError, wrap } from "../errors.js";
import { requireAnyone } from "../auth/middleware.js";
import type { Point } from "../geo.js";
import { listChallenges } from "../challenges/router.js";
import { progressFor } from "../submissions/scoring.js";
import { loadScoring } from "../submissions/load.js";
import { fetchGeometry } from "./osrm.js";
import { orderStops, straightLegs } from "./plan.js";

export const routeRouter: Router = Router();

function point(value: unknown): Point | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

// POST { from?: {lat,lng}, challenge_ids?: string[], keep_order?: boolean }
//   challenge_ids omitted → every located challenge the caller hasn't finished.
//   keep_order → draw the given order instead of optimizing it.
routeRouter.post(
  "/",
  requireAnyone,
  wrap(async (req, res) => {
    const event = req.event!;
    const from = point(req.body?.from);
    const keepOrder = req.body?.keep_order === true;
    const wanted: unknown = req.body?.challenge_ids;

    let challenges = (await listChallenges(event.id)).filter((c) => c.lat != null && c.lng != null);
    if (Array.isArray(wanted)) {
      const ids = new Set(wanted.filter((id): id is string => typeof id === "string"));
      challenges = challenges.filter((c) => ids.has(c.id));
      if (keepOrder) challenges.sort((a, b) => [...ids].indexOf(a.id) - [...ids].indexOf(b.id));
    } else if (req.participant) {
      const scoring = await loadScoring(event);
      challenges = challenges.filter((c) => progressFor(scoring, req.participant!.id, c.id).status !== "approved");
    }
    if (!challenges.length) throw new AppError("No located challenges to route between", 400, "NO_STOPS");

    const stops = challenges.map((c) => ({ lat: c.lat!, lng: c.lng! }));
    const order = keepOrder ? stops.map((_, i) => i) : orderStops(from, stops);
    const ordered = order.map((i) => challenges[i]!);
    const points: Point[] = [...(from ? [from] : []), ...ordered.map((c) => ({ lat: c.lat!, lng: c.lng! }))];

    const geometry = await fetchGeometry(env.routingUrl, points);
    const legs = geometry?.legs ?? straightLegs(points);
    const coordinates = geometry?.coordinates ?? points.map((p) => [p.lat, p.lng] as [number, number]);

    res.json({
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
  }),
);
