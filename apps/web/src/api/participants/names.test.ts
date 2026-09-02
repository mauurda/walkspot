import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNames } from "./names";

test("parseNames accepts a pasted list or an array, de-duplicates case-insensitively", () => {
  assert.deepEqual(parseNames("Ana\n bob , ana\n\nCarla  Díaz"), ["Ana", "bob", "Carla Díaz"]);
  assert.deepEqual(parseNames(["Ana", "ANA"]), ["Ana"]);
  assert.equal(parseNames(""), null);
  assert.equal(parseNames([1]), null);
  assert.equal(parseNames("x".repeat(61)), null);
});
