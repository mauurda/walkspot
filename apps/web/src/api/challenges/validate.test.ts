import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChallenge, validateChallengePatch } from "./validate";

test("create: title + points required, location optional and paired", () => {
  assert.deepEqual(validateChallenge({ title: " Find the fountain ", points: 50 }), {
    title: "Find the fountain",
    description: null,
    points: 50,
    place: null,
    lat: null,
    lng: null,
    radius_m: null,
    repeat_label: null,
    repeat_options: null,
    max_awards: 1,
  });
  assert.deepEqual(validateChallenge({ title: "x", points: 10, lat: 19.43, lng: -99.13 }), {
    title: "x",
    description: null,
    points: 10,
    place: null,
    lat: 19.43,
    lng: -99.13,
    radius_m: 100,
    repeat_label: null,
    repeat_options: null,
    max_awards: 1,
  });
  assert.equal(validateChallenge({ title: "x", points: 10, lat: 19.43 }), null);
  assert.equal(validateChallenge({ title: "x", points: 0 }), null);
  assert.equal(validateChallenge({ title: "x", points: 2.5 }), null);
  assert.equal(validateChallenge({ points: 5 }), null);
});

test("patch: clearing the location clears the radius; bad radius rejected", () => {
  assert.deepEqual(validateChallengePatch({ lat: null }), { lat: null, lng: null, radius_m: null });
  assert.deepEqual(validateChallengePatch({ lat: 1, lng: 2, radius_m: 250 }), { lat: 1, lng: 2, radius_m: 250 });
  assert.equal(validateChallengePatch({ lat: 1, lng: 2, radius_m: 5 }), null);
  assert.equal(validateChallengePatch({ lat: 91, lng: 0 }), null);
  assert.deepEqual(validateChallengePatch({ description: "" }), { description: null });
});

// ── repeatable challenges ───────────────────────────────────────────────────

test("create: a repeatable challenge takes a label, options and a cap", () => {
  assert.deepEqual(
    validateChallenge({
      title: "Rotation city food",
      points: 20,
      repeat_label: " Which city? ",
      repeat_options: ["SF", " Hyderabad ", "Berlin"],
      max_awards: 6,
    }),
    {
      title: "Rotation city food",
      description: null,
      points: 20,
      place: null,
      lat: null,
      lng: null,
      radius_m: null,
      repeat_label: "Which city?",
      repeat_options: ["SF", "Hyderabad", "Berlin"],
      max_awards: 6,
    },
  );
});

test("repeat: no label means it counts once, whatever the cap says", () => {
  const c = validateChallenge({ title: "x", points: 10 });
  assert.equal(c?.repeat_label, null);
  assert.equal(c?.repeat_options, null);
  assert.equal(c?.max_awards, 1);
});

test("repeat: blank options are dropped and an empty list means free text", () => {
  assert.deepEqual(validateChallengePatch({ repeat_options: ["Dolores", "  ", ""] }), { repeat_options: ["Dolores"] });
  assert.deepEqual(validateChallengePatch({ repeat_options: [] }), { repeat_options: null });
  assert.deepEqual(validateChallengePatch({ repeat_label: "   " }), { repeat_label: null });
});

test("repeat: a cap must be a whole number of at least one", () => {
  assert.equal(validateChallengePatch({ max_awards: 0 }), null);
  assert.equal(validateChallengePatch({ max_awards: 2.5 }), null);
  assert.equal(validateChallengePatch({ max_awards: 999 }), null);
  assert.deepEqual(validateChallengePatch({ max_awards: 10 }), { max_awards: 10 });
});

// ── place ───────────────────────────────────────────────────────────────────

test("place: a challenge can name where it happens, with or without a pin", () => {
  const c = validateChallenge({ title: "Shout in a circle", points: 20, place: "  Palace of Fine Arts " });
  assert.equal(c?.place, "Palace of Fine Arts");
  // A place needs no coordinates — "Old Minerva HQ" is a place we can name
  // and could not pin.
  assert.equal(c?.lat, null);
});

test("place: blank clears it, and it defaults to null", () => {
  assert.deepEqual(validateChallengePatch({ place: "   " }), { place: null });
  assert.deepEqual(validateChallengePatch({ place: null }), { place: null });
  assert.equal(validateChallenge({ title: "x", points: 10 })?.place, null);
});

test("place: too long is rejected", () => {
  assert.equal(validateChallengePatch({ place: "x".repeat(121) }), null);
})
