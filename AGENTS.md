# Walkspot — agent & contributor guide

One Next.js project serving the screens and the API. `README.md` is the
architecture; this file is the working rules. The principles come from
[`mauurda/shared`](https://github.com/mauurda/shared/blob/main/ARCHITECTURE.md).

## Layout (`apps/web`)

- `app/api/**/route.ts` — the API surface. Each file only re-exports
  handlers (`export { getBoard as GET } from "@/api/board/handlers"`) and
  declares `dynamic = "force-dynamic"`. No logic here, ever.
- `src/api/<resource>/` — the rules: `handlers.ts` (the endpoints, built
  with `http.ts`'s `route`/`eventRoute`), plus the pure modules beside them
  (`validate.ts`, `scoring.ts`, `plan.ts`, `media.ts`…) and a `README.md`
  where a rule is worth explaining. `src/api/http.ts` is the one adapter
  between Next and the domain; `auth/identify.ts` is who-is-asking.
  Server-only: nothing under `src/api` is imported by a client component,
  except type imports.
- `app/**/page.tsx`, `layout.tsx` — server components that only pick a
  screen and, for `/e/:code`, set the metadata. Screens live in
  `src/<feature>/` (`home/`, `join/`, `hunt/`, `organizer/`) as client
  components; primitives in `src/ui/`; the one map wrapper in `src/map/`
  (loaded with `ssr: false` — Leaflet needs `window`).
- `instrumentation.ts` / `instrumentation-client.ts` — Sentry, DSN-gated.
- `supabase/migrations/` (repo root) — the schema.

## Commands

- `npm run dev` · `npm run install:all`
- `npm run typecheck` · `npm test` · `npm run build`
- Delete `apps/web/tsconfig.tsbuildinfo` before a verifying typecheck.

## CI and deploy

CI is `ci.config.json` + the `@mauur/ci` box (no `.github/`; never add one).
Onboard the repo to the runner's allowlist once
(`shared/packages/ci/scripts/onboard.sh`). The app deploys from Vercel's git
integration (one project, root `apps/web`); migrations apply on merge through
Supabase's. Merge to `main` = release, so a green `ci/build` is a
precondition, not a formality.

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
  path. Never route a file body through a route handler (Vercel caps bodies
  at ~4.5MB and a video is ten times that).
- **Secrets are read lazily.** `src/api/env.ts` and the `admin` client build
  on first use, because `next build` evaluates route modules on a box with
  no `SUPABASE_URL`. Keep it that way; don't read `process.env` at module
  top level on the server.
- **Session reads happen after mount.** Pages are server-rendered with no
  localStorage; `src/useSession.ts` reads the device's tokens in an effect
  so the first client render matches the server's. Don't call `getHunt`
  during render.
- **Location is advisory.** `distance_m` vs `radius_m` is shown to
  reviewers, never enforced. GPS lies in courtyards.

## Conventions

- **Business logic behind the API.** The client renders and calls.
- **Additive forever.** No DELETE: `archived_at`, `removed_at`, `revoked_at`,
  a status. Reads filter to live rows; uniqueness is a partial index.
- **Whitelist writes.** Validators return only known keys; never spread a body.
- **Pure logic in its own file** so `node --test` drives it without a server
  or a browser (`tokens.ts`, `code.ts`, `validate.ts`, `scoring.ts`,
  `plan.ts`, `media.ts`, `session.ts`, `format.ts`). Those files import
  neither `next` nor `@/api/supabase` at runtime.
- **UI is composed.** Form controls come from `ui/` (label above, hint
  below, inline error, 44px targets). Markup used twice becomes a component.
- **Docs next to code.** Each resource with a rule worth explaining carries a
  `README.md` (`auth/`, `submissions/`, `route/`). No central docs dump.
- **Naming** — one word beats two (`claims`, `members`, `board`).
- **Verify before "done"** — `npm run typecheck && npm test && npm run build`.
