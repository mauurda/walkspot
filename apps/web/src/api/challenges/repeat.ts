/**
 * repeat.ts — "counts once per <thing>". Pure.
 *
 * A challenge with a `repeat_label` is repeatable: each proof names which one
 * it is for, and scoring pays out once per distinct answer up to `max_awards`.
 * Two people typing the same park must land on the same award, so answers
 * compare normalized — but the text we FILE is the display form, because the
 * feed reads "Dolores Park", not "dolores park".
 */
import type { Challenge } from "../supabase";

export type RepeatResult =
  | { ok: true; key: string | null }
  | { ok: false; reason: "required" | "not_an_option" };

/** The comparison form. Nothing fuzzier — the organizer still reviews. */
export function normalizeRepeatKey(key: string | null | undefined): string {
  return (key ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** What to file as this proof's `repeat_key`, or why we can't. */
export function resolveRepeatKey(challenge: Challenge, raw: unknown): RepeatResult {
  if (!challenge.repeat_label) return { ok: true, key: null };

  const typed = typeof raw === "string" ? raw.trim() : "";
  if (!typed) return { ok: false, reason: "required" };

  const options = challenge.repeat_options;
  if (!options?.length) return { ok: true, key: typed };

  // A fixed list is the vocabulary: snap the answer to the declared spelling
  // so the board can't split one city across two spellings.
  const wanted = normalizeRepeatKey(typed);
  const match = options.find((o) => normalizeRepeatKey(o) === wanted);
  return match ? { ok: true, key: match } : { ok: false, reason: "not_an_option" };
}
