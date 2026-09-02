/**
 * validate.ts — what a challenge may be created or edited with. Pure.
 *
 * A location is a pair: lat and lng arrive together or not at all, and
 * `radius_m` only means something alongside them. Sending `lat: null` clears
 * the location on edit.
 */
export const TITLE_MAX = 120;
export const DESCRIPTION_MAX = 2000;
export const POINTS_MAX = 10000;
export const RADIUS_DEFAULT = 100;
export const RADIUS_MIN = 10;
export const RADIUS_MAX = 5000;

export type ChallengeInput = {
  title: string;
  description: string | null;
  points: number;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
};

function isFinite(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** Only the keys present come back; null when any present key is invalid. */
export function validateChallengePatch(body: unknown): Partial<ChallengeInput> | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const out: Partial<ChallengeInput> = {};

  if ("title" in b) {
    if (typeof b.title !== "string") return null;
    const title = b.title.trim();
    if (!title || title.length > TITLE_MAX) return null;
    out.title = title;
  }
  if ("description" in b) {
    if (b.description != null && typeof b.description !== "string") return null;
    const description = typeof b.description === "string" ? b.description.trim() : "";
    if (description.length > DESCRIPTION_MAX) return null;
    out.description = description || null;
  }
  if ("points" in b) {
    if (!Number.isInteger(b.points) || (b.points as number) < 1 || (b.points as number) > POINTS_MAX) return null;
    out.points = b.points as number;
  }
  if ("lat" in b || "lng" in b || "radius_m" in b) {
    const located = b.lat != null || b.lng != null;
    if (located) {
      if (!isFinite(b.lat) || !isFinite(b.lng)) return null;
      if (Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180) return null;
      out.lat = b.lat;
      out.lng = b.lng;
      if (b.radius_m == null) out.radius_m = RADIUS_DEFAULT;
      else {
        if (!Number.isInteger(b.radius_m) || (b.radius_m as number) < RADIUS_MIN || (b.radius_m as number) > RADIUS_MAX) return null;
        out.radius_m = b.radius_m as number;
      }
    } else {
      out.lat = null;
      out.lng = null;
      out.radius_m = null;
    }
  }
  return out;
}

/** Full input for creation. */
export function validateChallenge(body: unknown): ChallengeInput | null {
  const patch = validateChallengePatch(body);
  if (!patch || !patch.title || !patch.points) return null;
  return {
    title: patch.title,
    description: patch.description ?? null,
    points: patch.points,
    lat: patch.lat ?? null,
    lng: patch.lng ?? null,
    radius_m: patch.lat != null ? (patch.radius_m ?? RADIUS_DEFAULT) : null,
  };
}
