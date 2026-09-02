/**
 * load.ts — resolve a `:code` into its live event. Every /api/events/:code
 * route starts here (via http.ts), and so does the join page's metadata.
 */
import { admin, type Event } from "../supabase";
import { AppError, dbError } from "../errors";
import { normalizeCode } from "./code";

export async function findEvent(rawCode: unknown): Promise<Event> {
  const code = normalizeCode(rawCode);
  if (!code) throw new AppError("That doesn't look like a hunt code", 404, "EVENT_NOT_FOUND");
  const { data, error } = await admin.from("events").select("*").eq("code", code).is("archived_at", null).maybeSingle();
  if (error) dbError(error);
  if (!data) throw new AppError("No hunt with that code", 404, "EVENT_NOT_FOUND");
  return data as Event;
}
