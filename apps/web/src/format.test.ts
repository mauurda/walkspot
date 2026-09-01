import { test } from "node:test";
import assert from "node:assert/strict";
import { describeBonus, formatAgo, formatDistance, formatDuration, formatPoints } from "./format.js";

test("distance and duration read like a walk", () => {
  assert.equal(formatDistance(420.4), "420 m");
  assert.equal(formatDistance(1234), "1.2 km");
  assert.equal(formatDistance(12_345), "12 km");
  assert.equal(formatDuration(20), "under a minute");
  assert.equal(formatDuration(600), "10 min");
  assert.equal(formatDuration(3600), "1 h");
  assert.equal(formatDuration(5400), "1 h 30 min");
});

test("points and ago", () => {
  assert.equal(formatPoints(1), "1 pt");
  assert.equal(formatPoints(125), "125 pts");
  const now = Date.parse("2026-09-01T12:00:00Z");
  assert.equal(formatAgo("2026-09-01T11:59:50Z", now), "just now");
  assert.equal(formatAgo("2026-09-01T11:30:00Z", now), "30 min ago");
  assert.equal(formatAgo("2026-08-31T10:00:00Z", now), "yesterday");
  assert.equal(describeBonus(25, 100), "+25% per extra person in the shot, up to +100%");
  assert.equal(describeBonus(0, 100), "No group bonus");
});
