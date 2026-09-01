/** load.ts — gather the rows scoring.ts reads, for one event. */
import { admin, type Challenge, type Event, type Member, type Submission } from "../supabase.js";
import { dbError } from "../errors.js";
import type { ScoringData } from "./scoring.js";

export async function loadScoring(event: Event): Promise<ScoringData> {
  const [challenges, submissions] = await Promise.all([
    admin.from("challenges").select("*").eq("event_id", event.id).is("archived_at", null),
    admin.from("submissions").select("*").eq("event_id", event.id),
  ]);
  if (challenges.error) dbError(challenges.error);
  if (submissions.error) dbError(submissions.error);
  const ids = (submissions.data as Submission[]).map((s) => s.id);
  const members = new Map<string, string[]>();
  if (ids.length) {
    const { data, error } = await admin.from("members").select("*").in("submission_id", ids);
    if (error) dbError(error);
    for (const m of data as Member[]) {
      const list = members.get(m.submission_id) ?? [];
      list.push(m.participant_id);
      members.set(m.submission_id, list);
    }
  }
  return {
    bonus: { group_bonus_pct: event.group_bonus_pct, group_bonus_cap: event.group_bonus_cap },
    challenges: new Map((challenges.data as Challenge[]).map((c) => [c.id, c])),
    submissions: submissions.data as Submission[],
    members,
  };
}
