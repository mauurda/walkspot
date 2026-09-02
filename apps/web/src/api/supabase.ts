import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

/**
 * Service-role client. Every table has RLS enabled with no policies, so this is
 * the only thing that can read or write them — the route handlers under
 * app/api are the whole authorization layer. Server-only; never imported by
 * a client component.
 *
 * Built on first use (see env.ts for why): the Proxy forwards every property
 * to one real client created the first time anything touches `admin`.
 */
let client: SupabaseClient | null = null;
export const admin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, key) {
    client ??= createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const value = client[key as keyof SupabaseClient];
    return typeof value === "function" ? (value as Function).bind(client) : value;
  },
});

/** Private bucket holding proof photos and videos; reads go through signed URLs. */
export const PROOFS_BUCKET = "proofs";

// ── Row types ───────────────────────────────────────────────────────────────

export type Event = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  passphrase_hash: string;
  auto_approve: boolean;
  group_bonus_pct: number;
  group_bonus_cap: number;
  created_at: string;
  archived_at: string | null;
};

/** One organizer login on one device. */
export type Organizer = {
  id: string;
  event_id: string;
  token_hash: string;
  label: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
};

/** A spot on the roster — a person the organizer expects to show up. */
export type Participant = {
  id: string;
  event_id: string;
  name: string;
  created_at: string;
  removed_at: string | null;
};

/** A device holding a spot. Live while revoked_at is null; at most one per spot. */
export type Claim = {
  id: string;
  event_id: string;
  participant_id: string;
  token_hash: string;
  device_label: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
};

export type Challenge = {
  id: string;
  event_id: string;
  title: string;
  description: string | null;
  points: number;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  position: number;
  created_at: string;
  archived_at: string | null;
};

export type SubmissionStatus = "pending" | "approved" | "rejected";

export type Submission = {
  id: string;
  event_id: string;
  challenge_id: string;
  participant_id: string;
  claim_id: string;
  media_path: string;
  media_type: "image" | "video";
  caption: string | null;
  lat: number | null;
  lng: number | null;
  distance_m: number | null;
  status: SubmissionStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
};

/** Everyone credited on a submission, submitter included. */
export type Member = {
  submission_id: string;
  participant_id: string;
};
