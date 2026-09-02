-- =============================================================================
-- walkspot — the whole schema of a hunt
--
-- Migrations apply on merge: the Supabase GitHub integration runs new files in
-- this directory against a per-PR preview branch, then against production when
-- the PR merges. Keep migrations additive; retire things with a NEW migration.
--
-- Every table has RLS enabled and NO policies: only the API's service-role
-- client touches them. Nothing here is ever DELETEd — removal is a timestamp
-- (archived_at, removed_at, revoked_at) or a status, and reads filter to live
-- rows. Uniqueness rides on partial indexes over the live rows.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.touch_last_seen() RETURNS TRIGGER
  LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.last_seen_at := now();
  RETURN NEW;
END;
$$;

-- ── events ──────────────────────────────────────────────────────────────────
-- One hunt. `code` is what participants type; the passphrase is what
-- organizers type. Both are the only secrets an event has.

CREATE TABLE IF NOT EXISTS public.events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code             TEXT NOT NULL,
  name             TEXT NOT NULL,
  description      TEXT,
  passphrase_hash  TEXT NOT NULL,
  auto_approve     BOOLEAN NOT NULL DEFAULT true,
  group_bonus_pct  INTEGER NOT NULL DEFAULT 25,
  group_bonus_cap  INTEGER NOT NULL DEFAULT 100,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ
);

COMMENT ON TABLE public.events IS 'One hunt: a roster, a set of challenges, a scoring rule.';
COMMENT ON COLUMN public.events.code IS 'Six-char join code, uppercase, no look-alike glyphs (events/code.ts).';
COMMENT ON COLUMN public.events.passphrase_hash IS 'scrypt$salt$hash of the organizer passphrase (auth/tokens.ts).';
COMMENT ON COLUMN public.events.auto_approve IS 'true: a proof counts the moment it lands; false: an organizer approves it first.';
COMMENT ON COLUMN public.events.group_bonus_pct IS 'Extra % of a challenge''s points per additional person credited on the proof.';
COMMENT ON COLUMN public.events.group_bonus_cap IS 'Ceiling on the total group bonus, in %.';

CREATE UNIQUE INDEX IF NOT EXISTS events_code_live_idx ON public.events (code) WHERE archived_at IS NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- ── organizers ──────────────────────────────────────────────────────────────
-- One row per organizer sign-in (creation, or a correct passphrase later).

CREATE TABLE IF NOT EXISTS public.organizers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES public.events (id),
  token_hash    TEXT NOT NULL UNIQUE,
  label         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ
);

COMMENT ON TABLE public.organizers IS 'Organizer device sessions; the bearer is wso_… and only its SHA-256 is stored.';

CREATE INDEX IF NOT EXISTS organizers_event_idx ON public.organizers (event_id);

ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

-- ── participants ────────────────────────────────────────────────────────────
-- The roster: the people an organizer expects. A row is a spot, not a login.

CREATE TABLE IF NOT EXISTS public.participants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events (id),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at  TIMESTAMPTZ
);

COMMENT ON TABLE public.participants IS 'Roster spots. Claimed by a device via claims.';

CREATE INDEX IF NOT EXISTS participants_event_live_idx ON public.participants (event_id) WHERE removed_at IS NULL;

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

-- ── claims ──────────────────────────────────────────────────────────────────
-- A device holding a spot. The partial unique index is the rule "one live
-- claim per spot": a second device racing for the same name loses with 23505
-- rather than with a check-then-insert gap.

CREATE TABLE IF NOT EXISTS public.claims (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events (id),
  participant_id  UUID NOT NULL REFERENCES public.participants (id),
  token_hash      TEXT NOT NULL UNIQUE,
  device_label    TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES public.organizers (id)
);

COMMENT ON TABLE public.claims IS 'Which device is which person. Only an organizer can revoke one.';
COMMENT ON COLUMN public.claims.revoked_by IS 'The organizer session that released the spot.';

CREATE UNIQUE INDEX IF NOT EXISTS claims_participant_live_idx ON public.claims (participant_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS claims_event_idx ON public.claims (event_id);

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

-- ── challenges ──────────────────────────────────────────────────────────────
-- lat/lng are both set or both null; a located challenge is one the route
-- planner can walk to and whose proofs get a distance check.

CREATE TABLE IF NOT EXISTS public.challenges (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id     UUID NOT NULL REFERENCES public.events (id),
  title        TEXT NOT NULL,
  description  TEXT,
  points       INTEGER NOT NULL CHECK (points > 0),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  radius_m     INTEGER,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at  TIMESTAMPTZ,
  CONSTRAINT challenges_location_pair CHECK ((lat IS NULL) = (lng IS NULL))
);

COMMENT ON TABLE public.challenges IS 'What there is to do. Located ones carry a point and a radius.';
COMMENT ON COLUMN public.challenges.radius_m IS 'How close a proof''s GPS fix should be to count as "there". Advisory, shown to reviewers.';

CREATE INDEX IF NOT EXISTS challenges_event_live_idx ON public.challenges (event_id, position) WHERE archived_at IS NULL;

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

-- ── submissions ─────────────────────────────────────────────────────────────
-- One proof: a photo or video in the private `proofs` bucket, who sent it,
-- where they were, and what the organizer made of it.

CREATE TABLE IF NOT EXISTS public.submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES public.events (id),
  challenge_id    UUID NOT NULL REFERENCES public.challenges (id),
  participant_id  UUID NOT NULL REFERENCES public.participants (id),
  claim_id        UUID NOT NULL REFERENCES public.claims (id),
  media_path      TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption         TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  distance_m      DOUBLE PRECISION,
  status          TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at     TIMESTAMPTZ,
  reviewed_by     UUID REFERENCES public.organizers (id),
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.submissions IS 'Proofs. Points are derived at read time from approved rows (submissions/scoring.ts).';
COMMENT ON COLUMN public.submissions.claim_id IS 'The device that uploaded — survives the spot being released and re-claimed.';
COMMENT ON COLUMN public.submissions.distance_m IS 'Metres from the challenge point at upload, when both fixes exist.';

CREATE INDEX IF NOT EXISTS submissions_event_created_idx ON public.submissions (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS submissions_challenge_idx ON public.submissions (challenge_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- ── members ─────────────────────────────────────────────────────────────────
-- Everyone credited on a proof, the uploader included. The group bonus is
-- the count of rows here.

CREATE TABLE IF NOT EXISTS public.members (
  submission_id   UUID NOT NULL REFERENCES public.submissions (id),
  participant_id  UUID NOT NULL REFERENCES public.participants (id),
  PRIMARY KEY (submission_id, participant_id)
);

COMMENT ON TABLE public.members IS 'Who is credited on a submission (tagged + uploader).';

CREATE INDEX IF NOT EXISTS members_participant_idx ON public.members (participant_id);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- ── storage ─────────────────────────────────────────────────────────────────
-- Private bucket. The API mints signed upload URLs (client PUTs straight to
-- Storage, never through Vercel's body cap) and signed read URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('proofs', 'proofs', false, 52428800)
ON CONFLICT (id) DO NOTHING;
