import { test } from "node:test";
import assert from "node:assert/strict";
import { clearOrganizer, clearParticipant, getHunt, listHunts, readSessions, setOrganizer, setParticipant, type Store } from "./session.js";

function memory(initial: Record<string, string> = {}): Store {
  const m = new Map(Object.entries(initial));
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
}

test("a claim is written once and survives a second attempt", () => {
  const store = memory();
  setParticipant(store, "ABCDEF", "Old town", { token: "wsp_1", id: "p1", name: "Ana" });
  setParticipant(store, "ABCDEF", "Old town", { token: "wsp_2", id: "p2", name: "Bob" });
  assert.deepEqual(getHunt(store, "ABCDEF").participant, { token: "wsp_1", id: "p1", name: "Ana" });
});

test("clearing the claim keeps the organizer session, and vice versa", () => {
  const store = memory();
  setParticipant(store, "X", "Hunt", { token: "wsp_1", id: "p1", name: "Ana" });
  setOrganizer(store, "X", "Hunt", { token: "wso_1" });
  clearParticipant(store, "X");
  assert.deepEqual(getHunt(store, "X"), { name: "Hunt", organizer: { token: "wso_1" } });
  clearOrganizer(store, "X");
  assert.deepEqual(getHunt(store, "X"), { name: "Hunt" });
  assert.deepEqual(listHunts(store), []);
});

test("corrupt storage reads as empty", () => {
  assert.deepEqual(readSessions(memory({ "walkspot.sessions": "{nope" })), {});
  assert.deepEqual(readSessions(memory({ "walkspot.sessions": "42" })), {});
});

test("listHunts reports the role on each hunt", () => {
  const store = memory();
  setParticipant(store, "A", "Alpha", { token: "t", id: "p", name: "Ana" });
  setOrganizer(store, "B", "Beta", { token: "o" });
  setOrganizer(store, "A", "Alpha", { token: "o2" });
  assert.deepEqual(listHunts(store), [
    { code: "A", name: "Alpha", role: "both", as: "Ana" },
    { code: "B", name: "Beta", role: "organizer", as: undefined },
  ]);
});
