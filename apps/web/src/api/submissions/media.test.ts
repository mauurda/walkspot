import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_BYTES, describeMedia, mediaTypeOfPath, proofPrefix } from "./media";

test("only photos and videos under the cap are accepted", () => {
  assert.deepEqual(describeMedia("image/jpeg", 1000), { ext: "jpg", media: "image" });
  assert.deepEqual(describeMedia("VIDEO/MP4", MAX_BYTES), { ext: "mp4", media: "video" });
  assert.equal(describeMedia("application/pdf", 10), null);
  assert.equal(describeMedia("image/jpeg", MAX_BYTES + 1), null);
  assert.equal(describeMedia("image/jpeg", 0), null);
});

test("media type reads back from the path the API minted", () => {
  const prefix = proofPrefix("e", "c", "p");
  assert.equal(prefix, "e/c/p/");
  assert.equal(mediaTypeOfPath(`${prefix}abc.mov`), "video");
  assert.equal(mediaTypeOfPath(`${prefix}abc.webp`), "image");
  assert.equal(mediaTypeOfPath(`${prefix}abc.exe`), null);
});
