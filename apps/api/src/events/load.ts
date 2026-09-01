/**
 * load.ts — resolve `:code` into req.event for every nested router, so each
 * resource router starts from a known live event and never re-parses the code.
 */
import type { RequestHandler } from "express";
import { admin, type Event } from "../supabase.js";
import { AppError, dbError, wrap } from "../errors.js";
import { normalizeCode } from "./code.js";

export async function findEvent(rawCode: unknown): Promise<Event> {
  const code = normalizeCode(rawCode);
  if (!code) throw new AppError("That doesn't look like a hunt code", 404, "EVENT_NOT_FOUND");
  const { data, error } = await admin.from("events").select("*").eq("code", code).is("archived_at", null).maybeSingle();
  if (error) dbError(error);
  if (!data) throw new AppError("No hunt with that code", 404, "EVENT_NOT_FOUND");
  return data as Event;
}

export const loadEvent: RequestHandler = wrap(async (req, _res, next) => {
  req.event = await findEvent(req.params.code);
  next();
});
