import { test } from "node:test";
import assert from "node:assert/strict";
import { CODE_ALPHABET, mintCode, normalizeCode } from "./code.js";

test("minted codes normalize to themselves", () => {
  for (let i = 0; i < 50; i++) {
    const code = mintCode();
    assert.equal(code.length, 6);
    assert.equal(normalizeCode(code), code);
    for (const ch of code) assert.ok(CODE_ALPHABET.includes(ch));
  }
});

test("normalize forgives case, spaces and dashes, rejects look-alikes", () => {
  assert.equal(normalizeCode(" abc-d2 3 "), "ABCD23");
  assert.equal(normalizeCode("ABC0DE"), null); // zero is not in the alphabet
  assert.equal(normalizeCode("ABCDE"), null);
  assert.equal(normalizeCode(42), null);
});
