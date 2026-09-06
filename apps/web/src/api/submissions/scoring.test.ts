import { test } from "node:test";
import assert from "node:assert/strict";
import type { Challenge, Submission } from "../supabase";
import { leaderboard, pointsFor, progressFor, submissionPoints, type ScoringData } from "./scoring";

const bonus = { group_bonus_pct: 25, group_bonus_cap: 100 };

function challenge(id: string, points: number): Challenge {
  return { id, event_id: "e", title: id, description: null, points, lat: null, lng: null, radius_m: null, position: 0, repeat_label: null, repeat_options: null, max_awards: 1, created_at: "", archived_at: null };
}

function submission(id: string, challenge_id: string, status: Submission["status"]): Submission {
  return {
    id, event_id: "e", challenge_id, participant_id: "ana", claim_id: "c", media_path: "p", media_type: "image",
    caption: null, lat: null, lng: null, distance_m: null, repeat_key: null, status, reviewed_at: null, reviewed_by: null, review_note: null, created_at: "",
  };
}

test("group bonus: +25% per extra person, capped at +100%", () => {
  assert.equal(pointsFor(100, 1, bonus), 100);
  assert.equal(pointsFor(100, 2, bonus), 125);
  assert.equal(pointsFor(100, 4, bonus), 175);
  assert.equal(pointsFor(100, 9, bonus), 200);
  assert.equal(pointsFor(30, 3, bonus), 45);
  assert.equal(pointsFor(100, 0, bonus), 100);
  assert.equal(pointsFor(100, 5, { group_bonus_pct: 0, group_bonus_cap: 100 }), 100);
});

const data: ScoringData = {
  bonus,
  challenges: new Map([
    ["fountain", challenge("fountain", 100)],
    ["mural", challenge("mural", 50)],
  ]),
  submissions: [
    submission("s1", "fountain", "approved"), // ana + bob
    submission("s2", "fountain", "rejected"), // carla alone
    submission("s3", "mural", "pending"), // ana alone
    submission("s4", "fountain", "approved"), // ana alone — worse than s1, must not double count
    submission("s5", "gone", "approved"), // archived challenge — worthless
  ],
  members: new Map([
    ["s1", ["ana", "bob"]],
    ["s2", ["carla"]],
    ["s3", ["ana"]],
    ["s4", ["ana"]],
    ["s5", ["bob"]],
  ]),
};

test("a proof is worth its base × bonus only while approved on a live challenge", () => {
  assert.equal(submissionPoints(data, data.submissions[0]!), 125);
  assert.equal(submissionPoints(data, data.submissions[1]!), 0);
  assert.equal(submissionPoints(data, data.submissions[2]!), 0);
  assert.equal(submissionPoints(data, data.submissions[4]!), 0);
});

test("progress ranks approved > pending > rejected > todo and keeps the best points", () => {
  assert.deepEqual(progressFor(data, "ana", "fountain"), { status: "approved", points: 125, awards: 1, submission_ids: ["s1", "s4"] });
  assert.deepEqual(progressFor(data, "ana", "mural"), { status: "pending", points: 0, awards: 0, submission_ids: ["s3"] });
  assert.deepEqual(progressFor(data, "carla", "fountain"), { status: "rejected", points: 0, awards: 0, submission_ids: ["s2"] });
  assert.deepEqual(progressFor(data, "bob", "mural"), { status: "todo", points: 0, awards: 0, submission_ids: [] });
});

test("leaderboard sums best-per-challenge, ties share a rank", () => {
  const roster = [
    { id: "carla", name: "Carla" },
    { id: "bob", name: "Bob" },
    { id: "ana", name: "Ana" },
  ];
  const rows = leaderboard(data, roster);
  assert.deepEqual(
    rows.map((r) => [r.rank, r.name, r.points, r.completed, r.pending]),
    [
      [1, "Ana", 125, 1, 1],
      [1, "Bob", 125, 1, 0],
      [3, "Carla", 0, 0, 0],
    ],
  );
});

// ── repeatable challenges ───────────────────────────────────────────────────
// A challenge with a `repeat_label` counts once per distinct `repeat_key`,
// up to `max_awards`. Everything else keeps scoring exactly as it did.

function repeatable(id: string, points: number, max_awards: number): Challenge {
  return { ...challenge(id, points), repeat_label: "Which park?", max_awards };
}

function keyed(id: string, challenge_id: string, status: Submission["status"], repeat_key: string | null): Submission {
  return { ...submission(id, challenge_id, status), repeat_key };
}

const parksData: ScoringData = {
  bonus,
  challenges: new Map([
    ["parks", repeatable("parks", 10, 3)],
    ["cities", repeatable("cities", 20, 2)],
  ]),
  submissions: [
    keyed("p1", "parks", "approved", "Dolores Park"),
    keyed("p2", "parks", "approved", "dolores  park"), // same park, different typing
    keyed("p3", "parks", "approved", "Alamo Square"),
    keyed("p4", "parks", "approved", "Buena Vista"),
    keyed("p5", "parks", "approved", "Golden Gate Park"), // 4th distinct — over the cap of 3
    keyed("c1", "cities", "approved", "Berlin"),
    keyed("c2", "cities", "rejected", "Taipei"),
  ],
  members: new Map([
    ["p1", ["ana"]], ["p2", ["ana"]], ["p3", ["ana"]], ["p4", ["ana"]], ["p5", ["ana"]],
    ["c1", ["ana"]], ["c2", ["ana"]],
  ]),
};

test("a repeatable challenge scores once per distinct key, up to its cap", () => {
  const p = progressFor(parksData, "ana", "parks");
  assert.equal(p.awards, 3, "four distinct parks, cap of three");
  assert.equal(p.points, 30, "3 × 10");
});

test("keys differing only in case or inner spacing are the same thing", () => {
  const solo: ScoringData = {
    ...parksData,
    submissions: [parksData.submissions[0]!, parksData.submissions[1]!],
    members: new Map([["p1", ["ana"]], ["p2", ["ana"]]]),
  };
  const p = progressFor(solo, "ana", "parks");
  assert.equal(p.awards, 1, "'Dolores Park' and 'dolores  park' are one park");
  assert.equal(p.points, 10);
});

test("a rejected proof does not consume an award slot", () => {
  const p = progressFor(parksData, "ana", "cities");
  assert.equal(p.awards, 1, "Berlin counts, the rejected Taipei does not");
  assert.equal(p.points, 20);
});

test("without a repeat label a challenge still scores once, however many proofs", () => {
  assert.equal(progressFor(data, "ana", "fountain").awards, 1);
  assert.equal(progressFor(data, "ana", "fountain").points, 125);
});
