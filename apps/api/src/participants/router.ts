/**
 * participants/router.ts — the roster and the one irreversible act in the app:
 * a device claiming a spot. Mounted under /events/:code/participants with the
 * event already loaded.
 */
import { Router } from "express";
import { admin, type Claim, type Participant } from "../supabase.js";
import { AppError, dbError, wrap } from "../errors.js";
import { requireAnyone, requireOrganizer } from "../auth/middleware.js";
import { hashToken, mintToken } from "../auth/tokens.js";
import { deviceLabel } from "../events/router.js";
import { listRoster, type Spot } from "./roster.js";
import { parseNames } from "./names.js";

export const participantsRouter: Router = Router();

function forParticipant(spot: Spot) {
  return { id: spot.id, name: spot.name, claimed: spot.claim !== null };
}

function forOrganizer(spot: Spot) {
  return {
    id: spot.id,
    name: spot.name,
    created_at: spot.created_at,
    claim: spot.claim
      ? { id: spot.claim.id, device_label: spot.claim.device_label, created_at: spot.claim.created_at, last_seen_at: spot.claim.last_seen_at }
      : null,
  };
}

participantsRouter.get(
  "/",
  requireAnyone,
  wrap(async (req, res) => {
    const roster = await listRoster(req.event!.id);
    res.json({ participants: req.organizer ? roster.map(forOrganizer) : roster.map(forParticipant) });
  }),
);

// Add people. Names already on the live roster are skipped, not errors —
// organizers paste lists that overlap.
participantsRouter.post(
  "/",
  requireOrganizer,
  wrap(async (req, res) => {
    const names = parseNames(req.body?.names);
    if (!names) throw new AppError("Give at least one name (60 characters max each)", 400, "VALIDATION_ERROR");
    const existing = new Set((await listRoster(req.event!.id)).map((p) => p.name.toLowerCase()));
    const fresh = names.filter((n) => !existing.has(n.toLowerCase()));
    const skipped = names.filter((n) => existing.has(n.toLowerCase()));
    let created: Participant[] = [];
    if (fresh.length) {
      const { data, error } = await admin
        .from("participants")
        .insert(fresh.map((name) => ({ event_id: req.event!.id, name })))
        .select("*");
      if (error) dbError(error);
      created = data as Participant[];
    }
    res.status(201).json({ created: created.map((p) => ({ id: p.id, name: p.name })), skipped });
  }),
);

async function liveSpot(eventId: string, id: string): Promise<Spot> {
  const spot = (await listRoster(eventId)).find((p) => p.id === id);
  if (!spot) throw new AppError("No such person on this hunt", 404, "PARTICIPANT_NOT_FOUND");
  return spot;
}

participantsRouter.patch(
  "/:id",
  requireOrganizer,
  wrap(async (req, res) => {
    const spot = await liveSpot(req.event!.id, req.params.id!);
    const [name] = parseNames([req.body?.name]) ?? [];
    if (!name) throw new AppError("A name is required", 400, "VALIDATION_ERROR");
    const { error } = await admin.from("participants").update({ name }).eq("id", spot.id);
    if (error) dbError(error);
    res.json({ participant: { id: spot.id, name } });
  }),
);

async function revokeClaim(claim: Claim, organizerId: string): Promise<void> {
  const { error } = await admin
    .from("claims")
    .update({ revoked_at: new Date().toISOString(), revoked_by: organizerId })
    .eq("id", claim.id)
    .is("revoked_at", null);
  if (error) dbError(error);
}

// Remove a spot from the roster. Their proofs and points stay in history;
// their device is logged out.
participantsRouter.delete(
  "/:id",
  requireOrganizer,
  wrap(async (req, res) => {
    const spot = await liveSpot(req.event!.id, req.params.id!);
    if (spot.claim) await revokeClaim(spot.claim, req.organizer!.id);
    const { error } = await admin.from("participants").update({ removed_at: new Date().toISOString() }).eq("id", spot.id);
    if (error) dbError(error);
    res.status(204).end();
  }),
);

// The claim. No auth: this IS how a device gets its credential. The partial
// unique index on claims(participant_id) WHERE revoked_at IS NULL settles a
// race between two phones picking the same name: exactly one insert wins.
participantsRouter.post(
  "/:id/claim",
  wrap(async (req, res) => {
    const spot = await liveSpot(req.event!.id, req.params.id!);
    if (spot.claim) throw new AppError(`${spot.name} is already taken on another device`, 409, "SPOT_TAKEN");

    const token = mintToken("participant");
    const label = typeof req.body?.device_label === "string" && req.body.device_label.trim()
      ? req.body.device_label.trim().slice(0, 60)
      : deviceLabel(req.header("user-agent"));
    const { error } = await admin.from("claims").insert({
      event_id: req.event!.id,
      participant_id: spot.id,
      token_hash: hashToken(token),
      device_label: label,
      user_agent: req.header("user-agent")?.slice(0, 300) ?? null,
    });
    if (error?.code === "23505") throw new AppError(`${spot.name} was just taken on another device`, 409, "SPOT_TAKEN");
    if (error) dbError(error);

    res.status(201).json({ token, participant: { id: spot.id, name: spot.name } });
  }),
);

// Release a spot: the only way a claim ends. The device that held it sees
// CLAIM_REVOKED on its next request; anyone can now claim the name again.
participantsRouter.post(
  "/:id/release",
  requireOrganizer,
  wrap(async (req, res) => {
    const spot = await liveSpot(req.event!.id, req.params.id!);
    if (!spot.claim) throw new AppError(`${spot.name} isn't claimed`, 409, "SPOT_OPEN");
    await revokeClaim(spot.claim, req.organizer!.id);
    res.status(204).end();
  }),
);
