import { test } from "node:test";
import assert from "node:assert/strict";
import { validateChallenge, validateChallengePatch } from "./validate";

test("create: title + points required, location optional and paired", () => {
  assert.deepEqual(validateChallenge({ title: " Find the fountain ", points: 50 }), {
    title: "Find the fountain",
    description: null,
    points: 50,
    lat: null,
    lng: null,
    radius_m: null,
  });
  assert.deepEqual(validateChallenge({ title: "x", points: 10, lat: 19.43, lng: -99.13 }), {
    title: "x",
    description: null,
    points: 10,
    lat: 19.43,
    lng: -99.13,
    radius_m: 100,
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
