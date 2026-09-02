/**
 * challenges/handlers.ts — what there is to do. Organizers write; everyone on
 * the hunt reads, and a participant's read carries their own progress.
 */
import { admin, type Challenge } from "../supabase";
import { AppError, dbError } from "../errors";
import { eventRoute, json, noContent } from "../http";
import { validateChallenge, validateChallengePatch } from "./validate";
import { progressFor } from "../submissions/scoring";
import { loadScoring } from "../submissions/load";

export async function listChallenges(eventId: string): Promise<Challenge[]> {
  const { data, error } = await admin
    .from("challenges")
    .select("*")
    .eq("event_id", eventId)
    .is("archived_at", null)
    .order("position")
    .order("created_at");
  if (error) dbError(error);
  return data as Challenge[];
}

async function liveChallenge(eventId: string, id: string | undefined): Promise<Challenge> {
  const challenge = (await listChallenges(eventId)).find((c) => c.id === id);
  if (!challenge) throw new AppError("No such challenge", 404, "CHALLENGE_NOT_FOUND");
  return challenge;
}

// GET /challenges
export const getChallenges = eventRoute("anyone", async ({ event, organizer, participant }) => {
  const challenges = await listChallenges(event.id);
  if (organizer) return json({ challenges });
  // A participant sees each challenge with where they stand on it.
  const scoring = await loadScoring(event);
  return json({ challenges: challenges.map((c) => ({ ...c, mine: progressFor(scoring, participant!.id, c.id) })) });
});

// POST /challenges
export const createChallenge = eventRoute("organizer", async ({ event, body }) => {
  const input = validateChallenge(body);
  if (!input) throw new AppError("A title and points (1–10000) are required; a location needs lat and lng", 400, "VALIDATION_ERROR");
  const existing = await listChallenges(event.id);
  const position = existing.reduce((max, c) => Math.max(max, c.position), 0) + 1;
  const { data, error } = await admin
    .from("challenges")
    .insert({ ...input, event_id: event.id, position })
    .select("*")
    .single();
  if (error) dbError(error);
  return json({ challenge: data as Challenge }, 201);
});

// POST /challenges/reorder — every live id, once, in the new order.
export const reorderChallenges = eventRoute("organizer", async ({ event, body }) => {
  const ids: unknown = body.ids;
  const live = await listChallenges(event.id);
  if (!Array.isArray(ids) || ids.length !== live.length || new Set(ids).size !== ids.length) {
    throw new AppError("Send every live challenge id exactly once", 400, "VALIDATION_ERROR");
  }
  const known = new Set(live.map((c) => c.id));
  for (const id of ids) if (typeof id !== "string" || !known.has(id)) throw new AppError("Unknown challenge id", 400, "VALIDATION_ERROR");
  await Promise.all((ids as string[]).map((id, i) => admin.from("challenges").update({ position: i + 1 }).eq("id", id)));
  return json({ challenges: await listChallenges(event.id) });
});

// PATCH /challenges/:id
export const patchChallenge = eventRoute("organizer", async ({ event, params, body }) => {
  const challenge = await liveChallenge(event.id, params.id);
  const patch = validateChallengePatch(body);
  if (!patch) throw new AppError("Invalid challenge fields", 400, "VALIDATION_ERROR");
  const { data, error } = await admin.from("challenges").update(patch).eq("id", challenge.id).select("*").single();
  if (error) dbError(error);
  return json({ challenge: data as Challenge });
});

// DELETE /challenges/:id — archive, not delete: proofs filed against it keep resolving.
export const archiveChallenge = eventRoute("organizer", async ({ event, params }) => {
  const challenge = await liveChallenge(event.id, params.id);
  const { error } = await admin.from("challenges").update({ archived_at: new Date().toISOString() }).eq("id", challenge.id);
  if (error) dbError(error);
  return noContent();
});
