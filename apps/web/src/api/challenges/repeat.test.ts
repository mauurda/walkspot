import { test } from "node:test";
import assert from "node:assert/strict";
import type { Challenge } from "../supabase";
import { normalizeRepeatKey, resolveRepeatKey } from "./repeat";

function challenge(over: Partial<Challenge> = {}): Challenge {
  return {
    id: "c", event_id: "e", title: "t", description: null, points: 10,
    lat: null, lng: null, radius_m: null, position: 0,
    repeat_label: null, repeat_options: null, max_awards: 1,
    created_at: "", archived_at: null, ...over,
  };
}

test("keys compare on trimmed, lower-cased, single-spaced text", () => {
  assert.equal(normalizeRepeatKey(" Dolores  Park "), "dolores park");
  assert.equal(normalizeRepeatKey("DOLORES PARK"), "dolores park");
  assert.equal(normalizeRepeatKey(null), "");
});

test("a challenge that isn't repeatable files no key, whatever was sent", () => {
  assert.deepEqual(resolveRepeatKey(challenge(), "Dolores Park"), { ok: true, key: null });
});

test("a free-text repeatable challenge keeps what the player typed", () => {
  const c = challenge({ repeat_label: "Which park?", max_awards: 10 });
  assert.deepEqual(resolveRepeatKey(c, "  Alamo Square "), { ok: true, key: "Alamo Square" });
});

test("a repeatable challenge needs an answer", () => {
  const c = challenge({ repeat_label: "Which park?", max_awards: 10 });
  assert.deepEqual(resolveRepeatKey(c, "   "), { ok: false, reason: "required" });
  assert.deepEqual(resolveRepeatKey(c, undefined), { ok: false, reason: "required" });
});

test("with a fixed option list the answer snaps to the declared spelling", () => {
  const c = challenge({ repeat_label: "Which city?", repeat_options: ["SF", "Hyderabad", "Buenos Aires"], max_awards: 6 });
  assert.deepEqual(resolveRepeatKey(c, "sf"), { ok: true, key: "SF" });
  assert.deepEqual(resolveRepeatKey(c, "buenos  aires"), { ok: true, key: "Buenos Aires" });
  assert.deepEqual(resolveRepeatKey(c, "Lisbon"), { ok: false, reason: "not_an_option" });
});
