/**
 * roster.ts — the live roster with each spot's live claim (or null). Shared by
 * the public join screen, the organizer's people list, and the tag picker.
 */
import { admin, type Claim, type Participant } from "../supabase.js";
import { dbError } from "../errors.js";

export type Spot = Participant & { claim: Claim | null };

export async function listRoster(eventId: string): Promise<Spot[]> {
  const [{ data: people, error }, { data: claims, error: claimsError }] = await Promise.all([
    admin.from("participants").select("*").eq("event_id", eventId).is("removed_at", null).order("name"),
    admin.from("claims").select("*").eq("event_id", eventId).is("revoked_at", null),
  ]);
  if (error) dbError(error);
  if (claimsError) dbError(claimsError);
  const byParticipant = new Map((claims as Claim[]).map((c) => [c.participant_id, c]));
  return (people as Participant[]).map((p) => ({ ...p, claim: byParticipant.get(p.id) ?? null }));
}
