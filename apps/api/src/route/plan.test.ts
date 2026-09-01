import { test } from "node:test";
import assert from "node:assert/strict";
import { orderStops, straightLegs } from "./plan.js";

// Four stops on a line east of the start, listed out of order.
const stops = [
  { lat: 0, lng: 0.03 },
  { lat: 0, lng: 0.01 },
  { lat: 0, lng: 0.04 },
  { lat: 0, lng: 0.02 },
];

test("orders stops by walking distance from the start", () => {
  assert.deepEqual(orderStops({ lat: 0, lng: 0 }, stops), [1, 3, 0, 2]);
});

test("without a start, still produces a path with no zig-zag", () => {
  const order = orderStops(null, stops);
  const lngs = order.map((i) => stops[i]!.lng);
  const sorted = [...lngs].sort((a, b) => a - b);
  assert.ok(lngs.join() === sorted.join() || lngs.join() === sorted.reverse().join(), `zig-zag: ${lngs}`);
});

test("2-opt untangles a crossing the greedy pass leaves", () => {
  // A square: greedy from a corner goes around; a bad start order would cross.
  const square = [
    { lat: 0, lng: 0 },
    { lat: 0.01, lng: 0.01 },
    { lat: 0, lng: 0.01 },
    { lat: 0.01, lng: 0 },
  ];
  const order = orderStops({ lat: -0.001, lng: 0 }, square);
  const legs = straightLegs(order.map((i) => square[i]!));
  const total = legs.reduce((s, l) => s + l.distance_m, 0);
  // Three sides of the square (~1113m each), not a diagonal.
  assert.ok(total < 3 * 1113 + 5, `total ${total}`);
});

test("degenerate inputs", () => {
  assert.deepEqual(orderStops(null, []), []);
  assert.deepEqual(orderStops({ lat: 0, lng: 0 }, [{ lat: 1, lng: 1 }]), [0]);
});

test("straight legs estimate at walking pace", () => {
  const legs = straightLegs([{ lat: 0, lng: 0 }, { lat: 0, lng: 0.01 }]);
  assert.equal(legs.length, 1);
  assert.ok(Math.abs(legs[0]!.distance_m - 1113) < 3);
  assert.equal(legs[0]!.duration_s, Math.round(legs[0]!.distance_m / 1.2));
});
