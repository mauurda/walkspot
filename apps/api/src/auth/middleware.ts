/**
 * middleware.ts — what "who is asking" means for every event route.
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
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { admin, type Claim, type Event, type Organizer, type Participant } from "../supabase.js";
import { AppError, dbError } from "../errors.js";
import { hashToken, roleOf } from "./tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by events/load.ts for every /events/:code/* route. */
      event?: Event;
      claim?: Claim;
      participant?: Participant;
      organizer?: Organizer;
    }
  }
}

function bearer(req: Request): string | null {
  const header = req.header("authorization");
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Resolve the token into req.claim/participant or req.organizer. Never blocks. */
async function identify(req: Request): Promise<void> {
  const token = bearer(req);
  const event = req.event;
  if (!token || !event) return;
  const role = roleOf(token);
  const token_hash = hashToken(token);

  if (role === "participant") {
    const { data: claim, error } = await admin
      .from("claims")
      .select("*")
      .eq("token_hash", token_hash)
      .eq("event_id", event.id)
      .maybeSingle();
    if (error) dbError(error);
    if (!claim) throw new AppError("This device's spot was released", 401, "CLAIM_REVOKED");
    if (claim.revoked_at) throw new AppError("This device's spot was released", 401, "CLAIM_REVOKED");

    const { data: participant, error: participantError } = await admin
      .from("participants")
      .select("*")
      .eq("id", claim.participant_id)
      .maybeSingle();
    if (participantError) dbError(participantError);
    if (!participant || participant.removed_at) {
      throw new AppError("This device's spot was released", 401, "CLAIM_REVOKED");
    }
    req.claim = claim as Claim;
    req.participant = participant as Participant;
    void admin.from("claims").update({ last_seen_at: new Date().toISOString() }).eq("id", claim.id);
    return;
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
    req.organizer = organizer as Organizer;
    void admin.from("organizers").update({ last_seen_at: new Date().toISOString() }).eq("id", organizer.id);
  }
}

function guard(check: (req: Request) => boolean, message: string, code: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      await identify(req);
      if (!check(req)) throw new AppError(message, 401, code);
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** 401 unless the token is a live claim on this event. */
export const requireParticipant = guard((req) => Boolean(req.participant), "Claim a spot first", "CLAIM_REQUIRED");

/** 401 unless the token is a live organizer session on this event. */
export const requireOrganizer = guard((req) => Boolean(req.organizer), "Organizer sign-in required", "ORGANIZER_REQUIRED");

/** 401 unless the token is either — for reads both sides share (board, feed). */
export const requireAnyone = guard(
  (req) => Boolean(req.participant || req.organizer),
  "Sign in to this hunt first",
  "AUTH_REQUIRED",
);
