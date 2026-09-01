import { test } from "node:test";
import assert from "node:assert/strict";
import { validateEvent, validateEventPatch } from "./validate.js";

test("create needs a name and a passphrase, fills defaults", () => {
  const out = validateEvent({ name: "  Old town hunt ", passphrase: "abcd" });
  assert.deepEqual(out, {
    name: "Old town hunt",
    description: null,
    auto_approve: true,
    group_bonus_pct: 25,
    group_bonus_cap: 100,
    passphrase: "abcd",
  });
  assert.equal(validateEvent({ name: "x", passphrase: "abc" }), null);
  assert.equal(validateEvent({ passphrase: "abcd" }), null);
  assert.equal(validateEvent({ name: "", passphrase: "abcd" }), null);
});

test("patch returns only present keys and rejects bad ones", () => {
  assert.deepEqual(validateEventPatch({ auto_approve: false }), { auto_approve: false });
  assert.deepEqual(validateEventPatch({ description: "  " }), { description: null });
  assert.equal(validateEventPatch({ group_bonus_pct: -1 }), null);
  assert.equal(validateEventPatch({ group_bonus_pct: 12.5 }), null);
  assert.equal(validateEventPatch({ name: "" }), null);
  assert.equal(validateEventPatch("nope"), null);
});
