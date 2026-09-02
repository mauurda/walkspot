# Walkspot

Photo-proof challenge hunts for groups. An organizer writes a roster and a set
of challenges — some tied to a place on the map, some doable anywhere — and
shares a six-letter code. Each player opens the link on their phone, taps
their own name once, and that phone *is* them for the rest of the hunt. They
prove a challenge with a photo or video, tag whoever did it with them for a
group bonus, and plan the walk between the places that are left.

```
apps/web            one Next.js project → one Vercel project
  app/api/…         the API: route handlers, one thin file per endpoint
  src/api/…         the rules behind them (auth, scoring, routing) — plain TS, tested
  app/…, src/…      the screens
supabase/migrations the schema; applies on merge
ci.config.json      the CI pipeline (@mauur/ci)
```

A native app, if it ever comes, is a second project beside this one that
calls the same `/api`.

## How it works

```mermaid
flowchart LR
    subgraph phone["a phone"]
        web["screens (client components)"]
        ls["localStorage<br>claim token · organizer token"]
    end
    subgraph next["apps/web on Vercel"]
        pages["app/… server layouts<br>(join-link metadata)"]
        api["app/api/… route handlers<br>→ src/api (the rules)"]
    end
    web --> ls
    web -->|"JSON, Bearer wsp_/wso_"| api
    api -->|service role| db[("Supabase Postgres<br>RLS on, no policies")]
    pages -->|"hunt name for the unfurl"| db
    api -->|"signed upload / read URLs"| storage[("Storage: proofs<br>private bucket")]
    web -->|"PUT file on the signed URL"| storage
    api -->|"order → streets"| osrm["OSRM foot profile<br>(ROUTING_URL)"]
    web --> tiles["OpenStreetMap tiles"]
```

**One project, two halves.** Everything under `/api` is a Next route handler
that does nothing but name a function in `src/api/<resource>/handlers.ts`;
`src/api/http.ts` is the one adapter (load the hunt, identify the caller,
parse the body, map errors). The rules — tokens, validation, scoring, route
order — are plain TypeScript with no Next import, which is what makes them
testable with `node:test` and reusable by a native client later.

**No accounts.** Two credentials exist and the API mints both:

- a **claim** (`wsp_…`) — this device holds one roster spot. Written once to
  the phone; the app never offers a way to change it. Only an organizer can
  *release* the spot, which logs the phone out on its next request and
  reopens the name. → `apps/web/src/api/auth/README.md`
- an **organizer session** (`wso_…`) — this device knows the hunt's
  passphrase. Created with the hunt, or later by typing the passphrase on
  `/o/<code>`.

**Points are never stored.** A proof is worth
`base × (1 + min(cap, pct × (people − 1)) / 100)` to everyone tagged on it;
per person and challenge only the best approved proof counts; the board is
derived on every read. Reject a proof, archive a challenge, or change the
bonus, and the board simply moves. → `apps/web/src/api/submissions/README.md`

**Media never touches the API.** The client asks for a signed upload slot,
PUTs the file straight to the private bucket, then files the path. Reads are
signed URLs good for an hour.

**Routes** come from a pure nearest-neighbour + 2-opt order and, when the
router answers, real walking streets; otherwise straight lines drawn dashed.

**The join link unfurls.** `/e/:code` is server-rendered just enough to put
the hunt's name and description in the page metadata, so the link pasted
into a group chat shows what it is. Everything after that is client-side:
the credential lives in the phone.
→ `apps/web/src/api/route/README.md`

## Screens

| path | who | what |
|---|---|---|
| `/` | anyone | enter a code, or create a hunt; hunts this device is on |
| `/new` | anyone | name, passphrase, scoring rule → becomes its organizer |
| `/e/:code` | new phone | pick your name (irreversible, and it says so) |
| `/e/:code` … `/c/:id` `/map` `/feed` `/board` | player | challenges + score, proof form with tagging, map + route plan, everyone's proofs, leaderboard |
| `/o/:code` | organizer | passphrase sign-in, then People (add · release · remove), Challenges (map picker, radius, order), Review (approve/reject with the GPS distance), Feed, Board, Setup (share links, scoring) |

## Setup

```bash
npm run install:all
cp apps/web/.env.example apps/web/.env.local
```

1. **Supabase** — create a project; put the URL and the service-role key in
   `apps/web/.env.local`. Connect the repo under *Integrations → GitHub* so
   `supabase/migrations/` applies on merge (the migration also creates the
   private `proofs` bucket).
2. **Routing** — nothing to do: `ROUTING_URL` defaults to the FOSSGIS foot
   profile. Point it at your own OSRM if the hunt is big, or blank it for
   straight lines only.
3. **Sentry** — optional, one DSN (`NEXT_PUBLIC_SENTRY_DSN`) gates both the
   server and the browser side.

```bash
npm run dev   # http://localhost:3000 — pages and /api together
```

## Deploy

One Vercel project, root directory `apps/web`, framework Next.js, Node 22.
Set the same three variables from `.env.example` in the project's
environment. Migrations apply on merge to `main` through the Supabase
integration — don't `db push` by hand, and keep them additive so code and
schema land in either order. There is no OTA or native build here: a merge
to `main` is a deploy.

## Verify

```bash
rm -f apps/web/tsconfig.tsbuildinfo
npm run typecheck && npm test && npm run build
```

Tests are `node:test` over the pure modules (tokens, codes, validation,
scoring, route order, media rules, device sessions, formatting); nothing
needs a database or a browser.
