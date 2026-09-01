/**
 * challenges/router.ts — what there is to do. Organizers write; everyone on
 * the hunt reads, and a participant's read carries their own progress.
 */
import { Router } from "express";
import { admin, type Challenge } from "../supabase.js";
import { AppError, dbError, wrap } from "../errors.js";
import { requireAnyone, requireOrganizer } from "../auth/middleware.js";
import { validateChallenge, validateChallengePatch } from "./validate.js";
import { progressFor } from "../submissions/scoring.js";
import { loadScoring } from "../submissions/load.js";

export const challengesRouter: Router = Router();

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

challengesRouter.get(
  "/",
  requireAnyone,
  wrap(async (req, res) => {
    const event = req.event!;
    const challenges = await listChallenges(event.id);
    if (req.organizer) return res.json({ challenges });
    // A participant sees each challenge with where they stand on it.
    const scoring = await loadScoring(event);
    const mine = req.participant!.id;
    res.json({
      challenges: challenges.map((c) => ({ ...c, mine: progressFor(scoring, mine, c.id) })),
    });
  }),
);

challengesRouter.post(
  "/",
  requireOrganizer,
  wrap(async (req, res) => {
    const input = validateChallenge(req.body);
    if (!input) throw new AppError("A title and points (1–10000) are required; a location needs lat and lng", 400, "VALIDATION_ERROR");
    const existing = await listChallenges(req.event!.id);
    const position = existing.reduce((max, c) => Math.max(max, c.position), 0) + 1;
    const { data, error } = await admin
      .from("challenges")
      .insert({ ...input, event_id: req.event!.id, position })
      .select("*")
      .single();
    if (error) dbError(error);
    res.status(201).json({ challenge: data as Challenge });
  }),
);

// New order for every live challenge, as a list of ids.
challengesRouter.post(
  "/reorder",
  requireOrganizer,
  wrap(async (req, res) => {
    const ids: unknown = req.body?.ids;
    const live = await listChallenges(req.event!.id);
    if (!Array.isArray(ids) || ids.length !== live.length || new Set(ids).size !== ids.length) {
      throw new AppError("Send every live challenge id exactly once", 400, "VALIDATION_ERROR");
    }
    const known = new Set(live.map((c) => c.id));
    for (const id of ids) if (typeof id !== "string" || !known.has(id)) throw new AppError("Unknown challenge id", 400, "VALIDATION_ERROR");
    await Promise.all(
      (ids as string[]).map((id, i) => admin.from("challenges").update({ position: i + 1 }).eq("id", id)),
    );
    res.json({ challenges: await listChallenges(req.event!.id) });
  }),
);

async function liveChallenge(eventId: string, id: string): Promise<Challenge> {
  const challenge = (await listChallenges(eventId)).find((c) => c.id === id);
  if (!challenge) throw new AppError("No such challenge", 404, "CHALLENGE_NOT_FOUND");
  return challenge;
}

challengesRouter.patch(
  "/:id",
  requireOrganizer,
  wrap(async (req, res) => {
    const challenge = await liveChallenge(req.event!.id, req.params.id!);
    const patch = validateChallengePatch(req.body);
    if (!patch) throw new AppError("Invalid challenge fields", 400, "VALIDATION_ERROR");
    const { data, error } = await admin.from("challenges").update(patch).eq("id", challenge.id).select("*").single();
    if (error) dbError(error);
    res.json({ challenge: data as Challenge });
  }),
);

// Archive, not delete: proofs already filed against it keep resolving.
challengesRouter.delete(
  "/:id",
  requireOrganizer,
  wrap(async (req, res) => {
    const challenge = await liveChallenge(req.event!.id, req.params.id!);
    const { error } = await admin.from("challenges").update({ archived_at: new Date().toISOString() }).eq("id", challenge.id);
    if (error) dbError(error);
    res.status(204).end();
  }),
);
