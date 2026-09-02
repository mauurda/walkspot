/**
 * api.ts — the HTTP client (browser side). Every call is scoped to a hunt code and a role,
 * because that is how the API is shaped: a token is only ever good for one
 * hunt, and this device may hold a claim on one hunt and organize another.
 *
 * A 401 with CLAIM_REVOKED is the one signal that clears a stored claim —
 * an organizer released the spot. ORGANIZER_REVOKED does the same for an
 * organizer session. Everything else is an error the screen shows.
 */
import { browserStore, clearOrganizer, clearParticipant, getHunt } from "./session";

// Same origin: the route handlers under app/api serve this very page.
const BASE_URL = "/api";

export const store = browserStore();

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type Role = "participant" | "organizer";

/** Fired when a stored credential is found dead, so layouts can re-render. */
const listeners = new Set<() => void>();
export function onSessionChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function notifySessionChange(): void {
  for (const fn of listeners) fn();
}

async function parse(res: Response): Promise<any> {
  if (res.status === 204) return null;
  return res.json().catch(() => ({}));
}

async function request<T>(path: string, init: RequestInit & { token?: string | null } = {}): Promise<T> {
  const { token, ...rest } = init;
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...rest.headers,
      },
    });
  } catch {
    // fetch only throws for the network itself — the API never answered.
    throw new ApiError("Can't reach Walkspot right now. Check your signal and try again.", 0, "NETWORK");
  }
  if (res.ok) return (await parse(res)) as T;
  const body = await parse(res);
  throw new ApiError(body?.error ?? `Request failed (${res.status})`, res.status, body?.code ?? "UNKNOWN");
}

/** A request as this device's role on a hunt; a dead credential clears itself. */
async function as<T>(code: string, role: Role, path: string, init: RequestInit = {}): Promise<T> {
  const hunt = getHunt(store, code);
  const token = role === "participant" ? hunt.participant?.token : hunt.organizer?.token;
  try {
    return await request<T>(`/events/${code}${path}`, { ...init, token });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      if (role === "participant" && (err.code === "CLAIM_REVOKED" || err.code === "CLAIM_REQUIRED")) {
        clearParticipant(store, code);
        notifySessionChange();
      }
      if (role === "organizer" && (err.code === "ORGANIZER_REVOKED" || err.code === "ORGANIZER_REQUIRED")) {
        clearOrganizer(store, code);
        notifySessionChange();
      }
    }
    throw err;
  }
}

const json = (body: unknown, method = "POST"): RequestInit => ({ method, body: JSON.stringify(body) });

// ── Types ───────────────────────────────────────────────────────────────────

export type Event = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  auto_approve: boolean;
  group_bonus_pct: number;
  group_bonus_cap: number;
  created_at: string;
};

export type Spot = { id: string; name: string; claimed: boolean };

export type RosterEntry = {
  id: string;
  name: string;
  created_at: string;
  claim: { id: string; device_label: string | null; created_at: string; last_seen_at: string } | null;
};

export type Progress = { status: "todo" | "pending" | "approved" | "rejected"; points: number; submission_ids: string[] };

export type Challenge = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  position: number;
  mine?: Progress;
};

export type ChallengeInput = {
  title: string;
  description: string | null;
  points: number;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
};

export type Person = { id: string; name: string };

export type Submission = {
  id: string;
  challenge_id: string;
  participant_id: string;
  media_url: string | null;
  media_type: "image" | "video";
  caption: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  points: number;
  challenge: { id: string; title: string; points: number; archived: boolean } | null;
  submitter: Person | null;
  members: Person[];
};

export type BoardRow = { participant_id: string; name: string; points: number; completed: number; pending: number; rank: number };

export type Route = {
  from: { lat: number; lng: number } | null;
  stops: { id: string; title: string; points: number; lat: number; lng: number }[];
  legs: { distance_m: number; duration_s: number }[];
  coordinates: [number, number][];
  total: { distance_m: number; duration_s: number };
  source: "streets" | "straight";
};

// ── Endpoints ───────────────────────────────────────────────────────────────

export const api = {
  // Public
  createEvent: (body: { name: string; description: string | null; passphrase: string; auto_approve: boolean; group_bonus_pct: number; group_bonus_cap: number }) =>
    request<{ event: Event; token: string }>("/events", json(body)),
  event: (code: string) => request<{ event: Event; participants: Spot[] }>(`/events/${code}`),
  claim: (code: string, participantId: string) =>
    request<{ token: string; participant: Person }>(`/events/${code}/participants/${participantId}/claim`, json({})),
  organizerLogin: (code: string, passphrase: string) =>
    request<{ event: Event; token: string }>(`/events/${code}/organizer`, json({ passphrase })),

  // Either role
  me: (code: string, role: Role) => as<{ role: Role; event: Event; participant?: Person }>(code, role, "/me"),
  board: (code: string, role: Role) => as<{ rows: BoardRow[]; challenges: number; total_points: number }>(code, role, "/board"),
  feed: (code: string, role: Role, query: { status?: string; challenge?: string; mine?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (query.status) q.set("status", query.status);
    if (query.challenge) q.set("challenge", query.challenge);
    if (query.mine) q.set("mine", "1");
    const qs = q.toString();
    return as<{ submissions: Submission[] }>(code, role, `/submissions${qs ? `?${qs}` : ""}`);
  },
  challenges: (code: string, role: Role) => as<{ challenges: Challenge[] }>(code, role, "/challenges"),
  route: (code: string, role: Role, body: { from?: { lat: number; lng: number } | null; challenge_ids?: string[]; keep_order?: boolean }) =>
    as<Route>(code, role, "/route", json(body)),

  // Participant
  people: (code: string) => as<{ participants: Spot[] }>(code, "participant", "/participants"),
  uploadUrl: (code: string, body: { challenge_id: string; content_type: string; size: number }) =>
    as<{ url: string; path: string; media_type: "image" | "video" }>(code, "participant", "/submissions/upload-url", json(body)),
  submit: (code: string, body: { challenge_id: string; path: string; caption: string | null; member_ids: string[]; lat: number | null; lng: number | null }) =>
    as<{ submission: Submission }>(code, "participant", "/submissions", json(body)),

  // Organizer
  updateEvent: (code: string, patch: Partial<Pick<Event, "name" | "description" | "auto_approve" | "group_bonus_pct" | "group_bonus_cap">>) =>
    as<{ event: Event }>(code, "organizer", "", json(patch, "PATCH")),
  roster: (code: string) => as<{ participants: RosterEntry[] }>(code, "organizer", "/participants"),
  addPeople: (code: string, names: string) => as<{ created: Person[]; skipped: string[] }>(code, "organizer", "/participants", json({ names })),
  renamePerson: (code: string, id: string, name: string) => as<{ participant: Person }>(code, "organizer", `/participants/${id}`, json({ name }, "PATCH")),
  removePerson: (code: string, id: string) => as<null>(code, "organizer", `/participants/${id}`, { method: "DELETE" }),
  releaseSpot: (code: string, id: string) => as<null>(code, "organizer", `/participants/${id}/release`, json({})),
  createChallenge: (code: string, body: ChallengeInput) => as<{ challenge: Challenge }>(code, "organizer", "/challenges", json(body)),
  updateChallenge: (code: string, id: string, body: Partial<ChallengeInput>) =>
    as<{ challenge: Challenge }>(code, "organizer", `/challenges/${id}`, json(body, "PATCH")),
  archiveChallenge: (code: string, id: string) => as<null>(code, "organizer", `/challenges/${id}`, { method: "DELETE" }),
  reorderChallenges: (code: string, ids: string[]) => as<{ challenges: Challenge[] }>(code, "organizer", "/challenges/reorder", json({ ids })),
  review: (code: string, id: string, status: "approved" | "rejected", note: string | null) =>
    as<{ submission: Submission }>(code, "organizer", `/submissions/${id}/review`, json({ status, note })),
};

/** Step 2 of an upload: the file goes straight to Storage on the signed URL. */
export async function putFile(url: string, file: Blob, contentType: string): Promise<void> {
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": contentType, "x-upsert": "false" } });
  if (!res.ok) throw new ApiError(`Upload failed (${res.status})`, res.status, "UPLOAD_FAILED");
}
