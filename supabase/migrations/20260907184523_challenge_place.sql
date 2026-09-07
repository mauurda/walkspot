-- =============================================================================
-- Where a challenge happens, in words.
--
-- A pin is for the map and the route planner; it tells a player nothing on a
-- card. `place` is the name a person would say out loud — "Bob's Donuts" —
-- and is deliberately independent of the coordinates: some places we can name
-- but not confidently pin (the old Minerva HQ), and a pin without a name
-- reads as a dot.
-- =============================================================================

ALTER TABLE public.challenges ADD COLUMN IF NOT EXISTS place TEXT;

COMMENT ON COLUMN public.challenges.place IS
  'Where it happens, in words. Independent of lat/lng — either may exist without the other.';
