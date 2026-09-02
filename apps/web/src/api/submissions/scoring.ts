/**
 * scoring.ts — how proofs turn into points. Pure; `load.ts` gathers the rows
 * these functions read.
 *
 * Nothing stores a score. A participant's total is derived on every read from
 * the approved submissions they are a member of, so rejecting a proof or
 * archiving a challenge changes the board with no bookkeeping to keep in sync.
 *
 *   points on a proof = round(base × (1 + min(cap, pct × (members − 1)) / 100))
 *
 * Everyone credited on the proof gets that same amount — a group proof is one
 * proof, not N. If a person is credited on several approved proofs for the
 * same challenge, only their best one counts.
 */
import type { Challenge, Event, Submission, SubmissionStatus } from "../supabase";

export type Bonus = Pick<Event, "group_bonus_pct" | "group_bonus_cap">;

export type ScoringData = {
  bonus: Bonus;
  /** Live challenges by id. Archived ones score nothing. */
  challenges: Map<string, Challenge>;
  submissions: Submission[];
  /** submission id → credited participant ids (uploader included). */
  members: Map<string, string[]>;
};

export function pointsFor(base: number, memberCount: number, bonus: Bonus): number {
  const extra = Math.max(0, memberCount - 1) * bonus.group_bonus_pct;
  return Math.round(base * (1 + Math.min(bonus.group_bonus_cap, extra) / 100));
}

/** What this proof is worth right now — 0 unless approved on a live challenge. */
export function submissionPoints(data: ScoringData, s: Submission): number {
  if (s.status !== "approved") return 0;
  const challenge = data.challenges.get(s.challenge_id);
  if (!challenge) return 0;
  return pointsFor(challenge.points, data.members.get(s.id)?.length ?? 1, data.bonus);
}

export type Progress = {
  /** approved beats pending beats rejected beats todo. */
  status: "todo" | SubmissionStatus;
  points: number;
  submission_ids: string[];
};

const RANK: Record<Progress["status"], number> = { todo: 0, rejected: 1, pending: 2, approved: 3 };

export function progressFor(data: ScoringData, participantId: string, challengeId: string): Progress {
  const out: Progress = { status: "todo", points: 0, submission_ids: [] };
  for (const s of data.submissions) {
    if (s.challenge_id !== challengeId) continue;
    if (!data.members.get(s.id)?.includes(participantId)) continue;
    out.submission_ids.push(s.id);
    if (RANK[s.status] > RANK[out.status]) out.status = s.status;
    out.points = Math.max(out.points, submissionPoints(data, s));
  }
  return out;
}

export type BoardRow = {
  participant_id: string;
  name: string;
  points: number;
  completed: number;
  pending: number;
  rank: number;
};

export function leaderboard(data: ScoringData, roster: { id: string; name: string }[]): BoardRow[] {
  const rows = roster.map((p) => {
    let points = 0;
    let completed = 0;
    let pending = 0;
    for (const challengeId of data.challenges.keys()) {
      const progress = progressFor(data, p.id, challengeId);
      points += progress.points;
      if (progress.status === "approved") completed++;
      else if (progress.status === "pending") pending++;
    }
    return { participant_id: p.id, name: p.name, points, completed, pending, rank: 0 };
  });
  rows.sort((a, b) => b.points - a.points || b.completed - a.completed || a.name.localeCompare(b.name));
  // Ties share a rank (1, 1, 3), the way a scoreboard reads out loud.
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.rank = prev && prev.points === row.points && prev.completed === row.completed ? prev.rank : i + 1;
  });
  return rows;
}
