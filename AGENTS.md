# Walkspot — agent & contributor guide

A web app (no native build) with an Express API. `README.md` is the
architecture; this file is the working rules. The principles come from
[`mauurda/shared`](https://github.com/mauurda/shared/blob/main/ARCHITECTURE.md).

## Layout

- `apps/api` — Express + Supabase. ESM (`"type": "module"`), so **relative
  imports need `.js` extensions** even though the source is `.ts`. One folder
  per resource (`auth/`, `events/`, `participants/`, `challenges/`,
  `submissions/`, `board/`, `route/`), each with its `router.ts`, mounted in
  `app.ts`. Sentry initializes in `src/instrument.ts`, imported first.
- `apps/web` — Vite + React + Tailwind v4 (tokens in `src/styles.css`),
  react-router, react-leaflet. Screens by feature (`home/`, `join/`, `hunt/`,
  `organizer/`); primitives in `ui/`; the one map wrapper in `map/`.

Two independent npm packages, no workspace tooling.

## Commands

- `npm run api` · `npm run web` · `npm run install:all`
- `npm run typecheck` · `npm test` · `npm run build`
- Delete `apps/*/tsconfig.tsbuildinfo` before a verifying typecheck.

## CI and deploy

CI is `ci.config.json` + the `@mauur/ci` box (no `.github/`; never add one).
Onboard the repo to the runner's allowlist once
(`shared/packages/ci/scripts/onboard.sh`). Both apps deploy from Vercel's git
integration; migrations apply on merge through Supabase's. Merge to `main`
= release, so a green `ci/build` is a precondition, not a formality.

## Rules that exist because of what this app is

- **A claim is written once.** `session.ts` refuses a second write for the
  same hunt, and only the API's `CLAIM_REVOKED` clears one. Don't add a
  "switch player" affordance; the organizer's Release is the undo.
- **`CLAIM_REVOKED` only on a definite answer.** The middleware turns a
  database transport error into a 500, never into a revocation — a flaky
  minute must not log a whole hunt out.
- **Points are derived, never stored.** All scoring goes through
  `submissions/scoring.ts` (pure, tested). If a screen needs a number, it
  asks the API, which asks scoring.
- **Media goes straight to Storage.** Signed upload URL → PUT → file the
  path. Never route a file body through the API (Vercel caps bodies at
  ~4.5MB and a video is ten times that).
- **Location is advisory.** `distance_m` vs `radius_m` is shown to
  reviewers, never enforced. GPS lies in courtyards.

## Conventions

- **Business logic behind the API.** The client renders and calls.
- **Additive forever.** No DELETE: `archived_at`, `removed_at`, `revoked_at`,
  a status. Reads filter to live rows; uniqueness is a partial index.
- **Whitelist writes.** Validators return only known keys; never spread a body.
- **Pure logic in its own file** so `node --test` drives it without a server
  or a browser (`tokens.ts`, `code.ts`, `validate.ts`, `scoring.ts`,
  `plan.ts`, `media.ts`, `session.ts`, `format.ts`).
- **UI is composed.** Form controls come from `ui/` (label above, hint
  below, inline error, 44px targets). Markup used twice becomes a component.
- **Docs next to code.** Each resource with a rule worth explaining carries a
  `README.md` (`auth/`, `submissions/`, `route/`). No central docs dump.
- **Naming** — one word beats two (`claims`, `members`, `board`).
- **Verify before "done"** — `npm run typecheck && npm test && npm run build`.
