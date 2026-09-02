/**
 * events/handlers.ts — creating a hunt, joining one, organizer sign-in, and
 * editing the hunt itself.
 */
import { admin, type Event } from "../supabase";
import { AppError, dbError } from "../errors";
import { eventRoute, json, route } from "../http";
import { hashPassphrase, hashToken, mintToken, verifyPassphrase } from "../auth/tokens";
import { mintCode } from "./code";
import { validateEvent, validateEventPatch } from "./validate";
import { listRoster } from "../participants/roster";

/** The event as anyone may see it — never the passphrase hash. */
export function publicEvent(event: Event) {
  const { passphrase_hash: _hidden, ...rest } = event;
  return rest;
}

/** A short, human label for a device from its user agent — display only. */
export function deviceLabel(ua: string | undefined): string | null {
  if (!ua) return null;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  if (/Linux/.test(ua)) return "Linux";
  return "Browser";
}

async function openOrganizerSession(eventId: string, label: string | null): Promise<string> {
  const token = mintToken("organizer");
  const { error } = await admin.from("organizers").insert({ event_id: eventId, token_hash: hashToken(token), label });
  if (error) dbError(error);
  return token;
}

// POST /api/events — create a hunt. The creator's device becomes its first organizer.
export const createEvent = route(async ({ body, ua }) => {
  const input = validateEvent(body);
  if (!input) throw new AppError("A name and a passphrase (4+ characters) are required", 400, "VALIDATION_ERROR");
  const { passphrase, ...fields } = input;

  // A code collision among live events is rare (31^6 ≈ 887M) but not
  // impossible; the partial unique index tells us, and we simply re-roll.
  let event: Event | null = null;
  for (let attempt = 0; attempt < 5 && !event; attempt++) {
    const { data, error } = await admin
      .from("events")
      .insert({ ...fields, code: mintCode(), passphrase_hash: hashPassphrase(passphrase) })
      .select("*")
      .single();
    if (error && error.code !== "23505") dbError(error);
    if (data) event = data as Event;
  }
  if (!event) throw new AppError("Could not allocate a hunt code", 500, "INTERNAL_ERROR");

  const token = await openOrganizerSession(event.id, deviceLabel(ua));
  return json({ event: publicEvent(event), token }, 201);
});

// GET /api/events/:code — what a device sees before it has claimed anyone.
export const getEvent = eventRoute("none", async ({ event }) => {
  const roster = await listRoster(event.id);
  return json({
    event: publicEvent(event),
    participants: roster.map((p) => ({ id: p.id, name: p.name, claimed: p.claim !== null })),
  });
});

// PATCH /api/events/:code
export const patchEvent = eventRoute("organizer", async ({ event, body }) => {
  const patch = validateEventPatch(body);
  if (!patch) throw new AppError("Invalid event fields", 400, "VALIDATION_ERROR");
  // Whitelisted update — validateEventPatch only returns known keys.
  const { data, error } = await admin.from("events").update(patch).eq("id", event.id).select("*").single();
  if (error) dbError(error);
  return json({ event: publicEvent(data as Event) });
});

// GET /api/events/:code/me — who am I here? Validates a stored token on load.
export const me = eventRoute("anyone", async ({ event, organizer, participant }) => {
  if (organizer) return json({ role: "organizer", event: publicEvent(event) });
  return json({ role: "participant", event: publicEvent(event), participant: { id: participant!.id, name: participant!.name } });
});

// POST /api/events/:code/organizer — the passphrase opens a new organizer session.
export const organizerLogin = eventRoute("none", async ({ event, body, ua }) => {
  const passphrase = typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  if (!passphrase || !verifyPassphrase(passphrase, event.passphrase_hash)) {
    throw new AppError("That passphrase isn't right", 401, "PASSPHRASE_INVALID");
  }
  const token = await openOrganizerSession(event.id, deviceLabel(ua));
  return json({ event: publicEvent(event), token });
});
