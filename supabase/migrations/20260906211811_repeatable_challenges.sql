-- =============================================================================
-- Repeatable challenges — "counts once per <thing>, up to N times"
--
-- Additive, like everything here. A challenge with a NULL repeat_label behaves
-- exactly as it did: one award, however many proofs. Setting the label turns
-- the challenge repeatable and makes the label the question the player answers
-- ("Which park?"); each distinct answer scores once, up to max_awards.
--
-- The de-duplication lives in submissions/scoring.ts, NOT in a unique index:
-- points are derived on every read, and a rejected "Dolores Park" must not
-- block a corrected resubmission of the same park.
-- =============================================================================

ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS repeat_label   TEXT,
  ADD COLUMN IF NOT EXISTS repeat_options TEXT[],
  ADD COLUMN IF NOT EXISTS max_awards     INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN public.challenges.repeat_label IS
  'NULL = counts once. Otherwise the question a player answers per proof ("Which park?").';
COMMENT ON COLUMN public.challenges.repeat_options IS
  'NULL = the answer is free text. Otherwise the only answers allowed, shown as a picker.';
COMMENT ON COLUMN public.challenges.max_awards IS
  'How many distinct answers may score. Only read when repeat_label is set.';

ALTER TABLE public.challenges
  ADD CONSTRAINT challenges_max_awards_positive CHECK (max_awards >= 1);

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS repeat_key TEXT;

COMMENT ON COLUMN public.submissions.repeat_key IS
  'Which one this proof is for ("Dolores Park"). NULL on a non-repeatable challenge.';
