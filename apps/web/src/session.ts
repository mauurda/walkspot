/**
 * session.ts — what this device remembers about each hunt. Pure over a
 * key/value store so node:test drives it without a browser.
 *
 * One record per hunt code:
 *   participant  the claim this device holds (token + who) — set once, and
 *                only ever cleared when the API says CLAIM_REVOKED
 *   organizer    an organizer session, if this device signed in with the passphrase
 *
 * A device can be both on the same hunt (the organizer playing along), and
 * can hold spots on several hunts.
 */
export type Store = { getItem(key: string): string | null; setItem(key: string, value: string): void };

export type ParticipantSession = { token: string; id: string; name: string };
export type OrganizerSession = { token: string };
export type HuntSession = { participant?: ParticipantSession; organizer?: OrganizerSession; name?: string };
export type Sessions = Record<string, HuntSession>;

const KEY = "walkspot.sessions";

export function readSessions(store: Store): Sessions {
  try {
    const raw = store.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? (parsed as Sessions) : {};
  } catch {
    return {};
  }
}

function write(store: Store, sessions: Sessions): Sessions {
  store.setItem(KEY, JSON.stringify(sessions));
  return sessions;
}

export function getHunt(store: Store, code: string): HuntSession {
  return readSessions(store)[code] ?? {};
}

/** The claim is written once; a second write for the same hunt is refused. */
export function setParticipant(store: Store, code: string, name: string, participant: ParticipantSession): Sessions {
  const sessions = readSessions(store);
  const hunt = sessions[code] ?? {};
  if (hunt.participant) return sessions;
  return write(store, { ...sessions, [code]: { ...hunt, name, participant } });
}

/** Only the API's CLAIM_REVOKED clears a claim — this is the one path that does it. */
export function clearParticipant(store: Store, code: string): Sessions {
  const sessions = readSessions(store);
  const { participant: _gone, ...hunt } = sessions[code] ?? {};
  return write(store, { ...sessions, [code]: hunt });
}

export function setOrganizer(store: Store, code: string, name: string, organizer: OrganizerSession): Sessions {
  const sessions = readSessions(store);
  return write(store, { ...sessions, [code]: { ...(sessions[code] ?? {}), name, organizer } });
}

export function clearOrganizer(store: Store, code: string): Sessions {
  const sessions = readSessions(store);
  const { organizer: _gone, ...hunt } = sessions[code] ?? {};
  return write(store, { ...sessions, [code]: hunt });
}

/** Hunts this device is part of, for the home screen — newest last, as joined. */
export function listHunts(store: Store): { code: string; name: string; role: "participant" | "organizer" | "both"; as?: string }[] {
  return Object.entries(readSessions(store))
    .filter(([, h]) => h.participant || h.organizer)
    .map(([code, h]) => ({
      code,
      name: h.name ?? code,
      role: h.participant && h.organizer ? "both" : h.participant ? "participant" : "organizer",
      as: h.participant?.name,
    }));
}

/** A store that never throws — private browsing can make localStorage refuse writes. */
export function browserStore(): Store {
  const memory = new Map<string, string>();
  return {
    getItem(key) {
      try {
        return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
      } catch {
        return memory.get(key) ?? null;
      }
    },
    setItem(key, value) {
      memory.set(key, value);
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // kept in memory for this page's life
      }
    },
  };
}
