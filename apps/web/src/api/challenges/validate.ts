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
export const PLACE_MAX = 120;
export const REPEAT_LABEL_MAX = 80;
export const REPEAT_OPTION_MAX = 80;
export const REPEAT_OPTIONS_MAX = 30;
export const MAX_AWARDS_MAX = 50;

export type ChallengeInput = {
  title: string;
  description: string | null;
  points: number;
  /** Where it happens, in words. Independent of the pin: a place can be named
   *  without coordinates, and a pin means nothing to a player without one. */
  place: string | null;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  repeat_label: string | null;
  repeat_options: string[] | null;
  max_awards: number;
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
  if ("place" in b) {
    if (b.place != null && typeof b.place !== "string") return null;
    const place = typeof b.place === "string" ? b.place.trim() : "";
    if (place.length > PLACE_MAX) return null;
    out.place = place || null;
  }
  if ("repeat_label" in b) {
    if (b.repeat_label != null && typeof b.repeat_label !== "string") return null;
    const label = typeof b.repeat_label === "string" ? b.repeat_label.trim() : "";
    if (label.length > REPEAT_LABEL_MAX) return null;
    out.repeat_label = label || null;
  }
  if ("repeat_options" in b) {
    if (b.repeat_options == null) out.repeat_options = null;
    else {
      if (!Array.isArray(b.repeat_options)) return null;
      if (b.repeat_options.length > REPEAT_OPTIONS_MAX) return null;
      const options: string[] = [];
      for (const raw of b.repeat_options) {
        if (typeof raw !== "string") return null;
        const option = raw.trim();
        if (!option) continue; // a blank row in the editor is not an option
        if (option.length > REPEAT_OPTION_MAX) return null;
        options.push(option);
      }
      out.repeat_options = options.length ? options : null;
    }
  }
  if ("max_awards" in b) {
    if (!Number.isInteger(b.max_awards) || (b.max_awards as number) < 1 || (b.max_awards as number) > MAX_AWARDS_MAX) return null;
    out.max_awards = b.max_awards as number;
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
    place: patch.place ?? null,
    lat: patch.lat ?? null,
    lng: patch.lng ?? null,
    radius_m: patch.lat != null ? (patch.radius_m ?? RADIUS_DEFAULT) : null,
    repeat_label: patch.repeat_label ?? null,
    repeat_options: patch.repeat_label ? (patch.repeat_options ?? null) : null,
    max_awards: patch.repeat_label ? (patch.max_awards ?? 1) : 1,
  };
}
