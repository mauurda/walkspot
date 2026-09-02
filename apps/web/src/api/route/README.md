# route — which way makes sense

Status: current · Scope: `apps/web/src/api/route` · Parent: `../../../../README.md` · Owns: stop ordering, walking geometry

`POST /api/events/:code/route` answers "I'm here, I still want these — in what
order, and along which streets?"

1. **Order** — `plan.ts`, pure: nearest-neighbour from the participant's
   position, then 2-opt until no reversal shortens the walk. Open path (it
   does not come back to the start). Tested.
2. **Geometry** — `osrm.ts`: the ordered points go to an OSRM-compatible
   server (`ROUTING_URL`, default the FOSSGIS foot profile openstreetmap.org
   uses) for the actual streets and per-leg distance/time. Any failure —
   timeout, rate limit, no server configured — degrades to straight lines
   with a walking-pace estimate, and the response says `source: "straight"`
   so the map can draw it dashed.

Sending `challenge_ids` routes exactly those (with `keep_order: true` to draw
the caller's own order); omitting them routes every located challenge the
participant hasn't finished.
