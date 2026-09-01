/**
 * events/router.ts — creating a hunt, joining one, and organizer sign-in.
 *
 * Mounted at /events with no event pre-loaded, so the routes that take a
 * :code call loadEvent themselves.
 */
import { Router } from "express";
import { admin, type Event } from "../supabase.js";
import { AppError, dbError, wrap } from "../errors.js";
import { hashPassphrase, hashToken, mintToken, verifyPassphrase } from "../auth/tokens.js";
import { requireAnyone, requireOrganizer } from "../auth/middleware.js";
import { mintCode } from "./code.js";
import { loadEvent } from "./load.js";
import { validateEvent, validateEventPatch } from "./validate.js";
import { listRoster } from "../participants/roster.js";

export const eventsRouter: Router = Router();

/** The event as anyone may see it — never the passphrase hash. */
export function publicEvent(event: Event) {
  const { passphrase_hash: _hidden, ...rest } = event;
  return rest;
}

async function openOrganizerSession(eventId: string, label: string | null): Promise<string> {
  const token = mintToken("organizer");
  const { error } = await admin
    .from("organizers")
    .insert({ event_id: eventId, token_hash: hashToken(token), label });
  if (error) dbError(error);
  return token;
}

// Create a hunt. The creator's device becomes its first organizer.
eventsRouter.post(
  "/",
  wrap(async (req, res) => {
    const input = validateEvent(req.body);
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

    const token = await openOrganizerSession(event.id, deviceLabel(req.header("user-agent")));
    res.status(201).json({ event: publicEvent(event), token });
  }),
);

// What a device sees before it has claimed anyone: enough to pick a name.
eventsRouter.get(
  "/:code",
  loadEvent,
  wrap(async (req, res) => {
    const event = req.event!;
    const roster = await listRoster(event.id);
    res.json({
      event: publicEvent(event),
      participants: roster.map((p) => ({ id: p.id, name: p.name, claimed: p.claim !== null })),
    });
  }),
);

// Who am I on this hunt? The client calls this on load to validate a stored token.
eventsRouter.get(
  "/:code/me",
  loadEvent,
  requireAnyone,
  wrap(async (req, res) => {
    const event = req.event!;
    if (req.organizer) return res.json({ role: "organizer", event: publicEvent(event) });
    const { id, name } = req.participant!;
    res.json({ role: "participant", event: publicEvent(event), participant: { id, name } });
  }),
);

// Organizer sign-in on another device: the passphrase opens a new session.
eventsRouter.post(
  "/:code/organizer",
  loadEvent,
  wrap(async (req, res) => {
    const event = req.event!;
    const passphrase = typeof req.body?.passphrase === "string" ? req.body.passphrase.trim() : "";
    if (!passphrase || !verifyPassphrase(passphrase, event.passphrase_hash)) {
      throw new AppError("That passphrase isn't right", 401, "PASSPHRASE_INVALID");
    }
    const token = await openOrganizerSession(event.id, deviceLabel(req.header("user-agent")));
    res.json({ event: publicEvent(event), token });
  }),
);

eventsRouter.patch(
  "/:code",
  loadEvent,
  requireOrganizer,
  wrap(async (req, res) => {
    const patch = validateEventPatch(req.body);
    if (!patch) throw new AppError("Invalid event fields", 400, "VALIDATION_ERROR");
    // Whitelisted update — validateEventPatch only returns known keys.
    const { data, error } = await admin.from("events").update(patch).eq("id", req.event!.id).select("*").single();
    if (error) dbError(error);
    res.json({ event: publicEvent(data as Event) });
  }),
);

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
