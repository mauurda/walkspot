/**
 * identify.ts — what "who is asking" means for every event route.
 *
 * The bearer token names either a live claim (a device holding a roster spot)
 * or a live organizer session. Both are looked up by hash and must belong to
 * the event in the URL — a token from one hunt is worthless on another.
 *
 * Revocation is immediate by construction: the row is checked on every
 * request, so an organizer releasing a spot logs that device out on its very
 * next call, which then sees CLAIM_REVOKED and clears its stored token.
 *
 * Because CLAIM_REVOKED makes the device FORGET its claim, it is only ever
 * sent on a definite answer from the database. A transport error is a 500:
 * a flaky minute must never log a whole hunt out.
 */
import { admin, type Claim, type Event, type Organizer, type Participant } from "../supabase";
import { AppError, dbError } from "../errors";
import { hashToken, roleOf } from "./tokens";

export type Actor = {
  claim?: Claim;
  participant?: Participant;
  organizer?: Organizer;
};

export async function identify(header: string | null, event: Event): Promise<Actor> {
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return {};
  const role = roleOf(token);
  const token_hash = hashToken(token);
  const now = new Date().toISOString();

  if (role === "participant") {
    const { data: claim, error } = await admin
      .from("claims")
      .select("*")
      .eq("token_hash", token_hash)
      .eq("event_id", event.id)
      .maybeSingle();
    if (error) dbError(error);
    if (!claim || claim.revoked_at) throw new AppError("This device's spot was released", 401, "CLAIM_REVOKED");

    const { data: participant, error: participantError } = await admin
      .from("participants")
      .select("*")
      .eq("id", claim.participant_id)
      .maybeSingle();
    if (participantError) dbError(participantError);
    if (!participant || participant.removed_at) throw new AppError("This device's spot was released", 401, "CLAIM_REVOKED");

    void admin.from("claims").update({ last_seen_at: now }).eq("id", claim.id).then(() => {});
    return { claim: claim as Claim, participant: participant as Participant };
  }

  if (role === "organizer") {
    const { data: organizer, error } = await admin
      .from("organizers")
      .select("*")
      .eq("token_hash", token_hash)
      .eq("event_id", event.id)
      .is("revoked_at", null)
      .maybeSingle();
    if (error) dbError(error);
    if (!organizer) throw new AppError("Organizer session ended", 401, "ORGANIZER_REVOKED");
    void admin.from("organizers").update({ last_seen_at: now }).eq("id", organizer.id).then(() => {});
    return { organizer: organizer as Organizer };
  }

  return {};
}
