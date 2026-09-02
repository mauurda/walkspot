/**
 * participants/handlers.ts — the roster and the one irreversible act in the
 * app: a device claiming a spot.
 */
import { admin, type Claim, type Participant } from "../supabase";
import { AppError, dbError } from "../errors";
import { eventRoute, json, noContent } from "../http";
import { hashToken, mintToken } from "../auth/tokens";
import { deviceLabel } from "../events/handlers";
import { listRoster, type Spot } from "./roster";
import { parseNames } from "./names";

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

async function liveSpot(eventId: string, id: string | undefined): Promise<Spot> {
  const spot = (await listRoster(eventId)).find((p) => p.id === id);
  if (!spot) throw new AppError("No such person on this hunt", 404, "PARTICIPANT_NOT_FOUND");
  return spot;
}

async function revokeClaim(claim: Claim, organizerId: string): Promise<void> {
  const { error } = await admin
    .from("claims")
    .update({ revoked_at: new Date().toISOString(), revoked_by: organizerId })
    .eq("id", claim.id)
    .is("revoked_at", null);
  if (error) dbError(error);
}

// GET /participants
export const listParticipants = eventRoute("anyone", async ({ event, organizer }) => {
  const roster = await listRoster(event.id);
  return json({ participants: organizer ? roster.map(forOrganizer) : roster.map(forParticipant) });
});

// POST /participants — names already on the live roster are skipped, not
// errors: organizers paste lists that overlap.
export const addParticipants = eventRoute("organizer", async ({ event, body }) => {
  const names = parseNames(body.names);
  if (!names) throw new AppError("Give at least one name (60 characters max each)", 400, "VALIDATION_ERROR");
  const existing = new Set((await listRoster(event.id)).map((p) => p.name.toLowerCase()));
  const fresh = names.filter((n) => !existing.has(n.toLowerCase()));
  const skipped = names.filter((n) => existing.has(n.toLowerCase()));
  let created: Participant[] = [];
  if (fresh.length) {
    const { data, error } = await admin
      .from("participants")
      .insert(fresh.map((name) => ({ event_id: event.id, name })))
      .select("*");
    if (error) dbError(error);
    created = data as Participant[];
  }
  return json({ created: created.map((p) => ({ id: p.id, name: p.name })), skipped }, 201);
});

// PATCH /participants/:id
export const renameParticipant = eventRoute("organizer", async ({ event, params, body }) => {
  const spot = await liveSpot(event.id, params.id);
  const [name] = parseNames([body.name]) ?? [];
  if (!name) throw new AppError("A name is required", 400, "VALIDATION_ERROR");
  const { error } = await admin.from("participants").update({ name }).eq("id", spot.id);
  if (error) dbError(error);
  return json({ participant: { id: spot.id, name } });
});

// DELETE /participants/:id — off the roster. Their proofs and points stay in
// history; their device is logged out.
export const removeParticipant = eventRoute("organizer", async ({ event, params, organizer }) => {
  const spot = await liveSpot(event.id, params.id);
  if (spot.claim) await revokeClaim(spot.claim, organizer!.id);
  const { error } = await admin.from("participants").update({ removed_at: new Date().toISOString() }).eq("id", spot.id);
  if (error) dbError(error);
  return noContent();
});

// POST /participants/:id/claim — no auth: this IS how a device gets its
// credential. The partial unique index on claims(participant_id) WHERE
// revoked_at IS NULL settles a race between two phones picking the same
// name: exactly one insert wins.
export const claimSpot = eventRoute("none", async ({ event, params, body, ua }) => {
  const spot = await liveSpot(event.id, params.id);
  if (spot.claim) throw new AppError(`${spot.name} is already taken on another device`, 409, "SPOT_TAKEN");

  const token = mintToken("participant");
  const label = typeof body.device_label === "string" && body.device_label.trim() ? body.device_label.trim().slice(0, 60) : deviceLabel(ua);
  const { error } = await admin.from("claims").insert({
    event_id: event.id,
    participant_id: spot.id,
    token_hash: hashToken(token),
    device_label: label,
    user_agent: ua?.slice(0, 300) ?? null,
  });
  if (error?.code === "23505") throw new AppError(`${spot.name} was just taken on another device`, 409, "SPOT_TAKEN");
  if (error) dbError(error);

  return json({ token, participant: { id: spot.id, name: spot.name } }, 201);
});

// POST /participants/:id/release — the only way a claim ends. The device that
// held it sees CLAIM_REVOKED on its next request; anyone can claim the name again.
export const releaseSpot = eventRoute("organizer", async ({ event, params, organizer }) => {
  const spot = await liveSpot(event.id, params.id);
  if (!spot.claim) throw new AppError(`${spot.name} isn't claimed`, 409, "SPOT_OPEN");
  await revokeClaim(spot.claim, organizer!.id);
  return noContent();
});
