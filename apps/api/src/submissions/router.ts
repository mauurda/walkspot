/**
 * submissions/router.ts — proofs: minting an upload slot, filing the proof
 * with its tagged group, reading the feed, and organizer review.
 *
 * Media never passes through this API. The client asks for a signed upload
 * URL, PUTs the file straight to Storage, then files the path — so a 40MB
 * video is between the phone and Supabase, not inside a serverless body.
 */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { admin, PROOFS_BUCKET, type Challenge, type Participant, type Submission, type SubmissionStatus } from "../supabase.js";
import { AppError, dbError, wrap } from "../errors.js";
import { requireAnyone, requireOrganizer, requireParticipant } from "../auth/middleware.js";
import { distanceM } from "../geo.js";
import { listChallenges } from "../challenges/router.js";
import { listRoster } from "../participants/roster.js";
import { describeMedia, mediaTypeOfPath, proofPrefix } from "./media.js";
import { submissionPoints } from "./scoring.js";
import { loadScoring } from "./load.js";

export const submissionsRouter: Router = Router();

const CAPTION_MAX = 500;
const NOTE_MAX = 500;
const READ_URL_TTL_S = 60 * 60;

async function liveChallenge(eventId: string, id: unknown): Promise<Challenge> {
  if (typeof id !== "string") throw new AppError("challenge_id is required", 400, "VALIDATION_ERROR");
  const challenge = (await listChallenges(eventId)).find((c) => c.id === id);
  if (!challenge) throw new AppError("No such challenge", 404, "CHALLENGE_NOT_FOUND");
  return challenge;
}

// Step 1 of an upload: a slot in the bucket this device may write once.
submissionsRouter.post(
  "/upload-url",
  requireParticipant,
  wrap(async (req, res) => {
    const challenge = await liveChallenge(req.event!.id, req.body?.challenge_id);
    const media = describeMedia(req.body?.content_type, req.body?.size);
    if (!media) throw new AppError("Send a photo or video up to 50MB", 400, "MEDIA_UNSUPPORTED");

    const path = `${proofPrefix(req.event!.id, challenge.id, req.participant!.id)}${randomUUID()}.${media.ext}`;
    const { data, error } = await admin.storage.from(PROOFS_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new AppError(error?.message ?? "Could not prepare upload", 500, "INTERNAL_ERROR");
    res.json({ url: data.signedUrl, path: data.path, media_type: media.media });
  }),
);

// Step 2: file the proof. The path must be one of this device's own slots and
// the object must actually be there.
submissionsRouter.post(
  "/",
  requireParticipant,
  wrap(async (req, res) => {
    const event = req.event!;
    const me = req.participant!;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const challenge = await liveChallenge(event.id, body.challenge_id);

    const path = typeof body.path === "string" ? body.path : "";
    const media_type = mediaTypeOfPath(path);
    if (!path.startsWith(proofPrefix(event.id, challenge.id, me.id)) || !media_type) {
      throw new AppError("That upload doesn't belong to this proof", 400, "MEDIA_PATH_INVALID");
    }
    const probe = await admin.storage.from(PROOFS_BUCKET).createSignedUrl(path, 60);
    if (probe.error) throw new AppError("The file never arrived — try the upload again", 400, "MEDIA_MISSING");

    const caption = typeof body.caption === "string" ? body.caption.trim().slice(0, CAPTION_MAX) || null : null;

    const roster = await listRoster(event.id);
    const rosterIds = new Set(roster.map((p) => p.id));
    const tagged = Array.isArray(body.member_ids) ? body.member_ids : [];
    const memberIds = new Set<string>([me.id]);
    for (const id of tagged) {
      if (typeof id !== "string" || !rosterIds.has(id)) throw new AppError("Tagged someone who isn't on this hunt", 400, "MEMBER_INVALID");
      memberIds.add(id);
    }

    const lat = typeof body.lat === "number" && Number.isFinite(body.lat) ? body.lat : null;
    const lng = typeof body.lng === "number" && Number.isFinite(body.lng) ? body.lng : null;
    const distance_m =
      lat != null && lng != null && challenge.lat != null && challenge.lng != null
        ? Math.round(distanceM({ lat, lng }, { lat: challenge.lat, lng: challenge.lng }))
        : null;

    const { data, error } = await admin
      .from("submissions")
      .insert({
        event_id: event.id,
        challenge_id: challenge.id,
        participant_id: me.id,
        claim_id: req.claim!.id,
        media_path: path,
        media_type,
        caption,
        lat,
        lng,
        distance_m,
        status: event.auto_approve ? "approved" : "pending",
      })
      .select("*")
      .single();
    if (error) dbError(error);
    const submission = data as Submission;

    const members = await admin
      .from("members")
      .insert([...memberIds].map((participant_id) => ({ submission_id: submission.id, participant_id })));
    if (members.error) dbError(members.error);

    const [hydrated] = await hydrate(event, [submission]);
    res.status(201).json({ submission: hydrated });
  }),
);

export type HydratedSubmission = Omit<Submission, "media_path"> & {
  media_url: string | null;
  points: number;
  challenge: { id: string; title: string; points: number; archived: boolean } | null;
  submitter: { id: string; name: string } | null;
  members: { id: string; name: string }[];
};

/** Attach everything a card needs: signed media URL, names, challenge, live points. */
export async function hydrate(event: NonNullable<Express.Request["event"]>, subs: Submission[]): Promise<HydratedSubmission[]> {
  if (!subs.length) return [];
  const [scoring, urls, people, allChallenges] = await Promise.all([
    loadScoring(event),
    admin.storage.from(PROOFS_BUCKET).createSignedUrls(subs.map((s) => s.media_path), READ_URL_TTL_S),
    admin.from("participants").select("*").eq("event_id", event.id),
    admin.from("challenges").select("*").eq("event_id", event.id),
  ]);
  if (people.error) dbError(people.error);
  if (allChallenges.error) dbError(allChallenges.error);
  const urlByPath = new Map((urls.data ?? []).map((u) => [u.path, u.signedUrl]));
  const nameById = new Map((people.data as Participant[]).map((p) => [p.id, { id: p.id, name: p.name }]));
  const challengeById = new Map((allChallenges.data as Challenge[]).map((c) => [c.id, c]));

  return subs.map((s) => {
    const { media_path, ...rest } = s;
    const challenge = challengeById.get(s.challenge_id);
    return {
      ...rest,
      media_url: urlByPath.get(media_path) ?? null,
      points: submissionPoints(scoring, s),
      challenge: challenge
        ? { id: challenge.id, title: challenge.title, points: challenge.points, archived: challenge.archived_at !== null }
        : null,
      submitter: nameById.get(s.participant_id) ?? null,
      members: (scoring.members.get(s.id) ?? []).map((id) => nameById.get(id)).filter((m): m is { id: string; name: string } => Boolean(m)),
    };
  });
}

// The feed. Participants see approved + pending proofs from everyone (rejected
// ones only when their own); organizers see everything and can filter.
//   ?status=pending|approved|rejected   ?challenge=<id>   ?mine=1
submissionsRouter.get(
  "/",
  requireAnyone,
  wrap(async (req, res) => {
    const event = req.event!;
    let query = admin.from("submissions").select("*").eq("event_id", event.id).order("created_at", { ascending: false }).limit(300);
    const status = req.query.status;
    if (status === "pending" || status === "approved" || status === "rejected") query = query.eq("status", status);
    if (typeof req.query.challenge === "string") query = query.eq("challenge_id", req.query.challenge);
    const { data, error } = await query;
    if (error) dbError(error);

    let subs = data as Submission[];
    if (req.participant) {
      const me = req.participant.id;
      const scoring = await loadScoring(event);
      const isMine = (s: Submission) => scoring.members.get(s.id)?.includes(me) ?? false;
      subs = req.query.mine ? subs.filter(isMine) : subs.filter((s) => s.status !== "rejected" || isMine(s));
    }
    res.json({ submissions: await hydrate(event, subs) });
  }),
);

// Review. Approving is what makes points real when auto_approve is off;
// rejecting takes them away either way. Both are reversible by another review.
submissionsRouter.post(
  "/:id/review",
  requireOrganizer,
  wrap(async (req, res) => {
    const status = req.body?.status as SubmissionStatus;
    if (status !== "approved" && status !== "rejected") throw new AppError("status must be approved or rejected", 400, "VALIDATION_ERROR");
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, NOTE_MAX) || null : null;
    const { data, error } = await admin
      .from("submissions")
      .update({ status, review_note: note, reviewed_at: new Date().toISOString(), reviewed_by: req.organizer!.id })
      .eq("id", req.params.id!)
      .eq("event_id", req.event!.id)
      .select("*")
      .maybeSingle();
    if (error) dbError(error);
    if (!data) throw new AppError("No such proof", 404, "SUBMISSION_NOT_FOUND");
    const [hydrated] = await hydrate(req.event!, [data as Submission]);
    res.json({ submission: hydrated });
  }),
);
