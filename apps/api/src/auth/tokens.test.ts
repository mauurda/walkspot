import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassphrase, hashToken, mintToken, roleOf, verifyPassphrase } from "./tokens.js";

test("tokens carry their role in the prefix", () => {
  assert.equal(roleOf(mintToken("participant")), "participant");
  assert.equal(roleOf(mintToken("organizer")), "organizer");
  assert.equal(roleOf("nonsense"), null);
  assert.equal(roleOf(""), null);
});

test("two mints never collide and the hash is stable", () => {
  const a = mintToken("participant");
  const b = mintToken("participant");
  assert.notEqual(a, b);
  assert.equal(hashToken(a), hashToken(a));
  assert.notEqual(hashToken(a), hashToken(b));
  assert.equal(hashToken(a).length, 64);
});

test("passphrase verifies only against itself", () => {
  const stored = hashPassphrase("correct horse");
  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(verifyPassphrase("correct horse", stored), true);
  assert.equal(verifyPassphrase("correct horse ", stored), false);
  assert.equal(verifyPassphrase("wrong", stored), false);
  assert.equal(verifyPassphrase("correct horse", "garbage"), false);
});

test("passphrase salt differs per hash", () => {
  assert.notEqual(hashPassphrase("x"), hashPassphrase("x"));
});
