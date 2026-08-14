# ADR 0015 — The height ceiling is 8, and The Blank is authored

Status: Accepted

Verdict: **proceed**

## Context

`TERRAIN_PEAK_MAX` was 3. That was right for the vertical slice — a 3-high terrace is a legible
staircase and nothing more — but it cannot produce a landmark. With a 320 × 320 floor (ADR 0012) the
map had range and no relief: every silhouette was the same three steps, so nothing was worth walking
toward, and the pacing table's POI ceiling of 211 cells was unmeetable because there were no POIs.

Two questions had to be answered together, because answering either alone produces a worse map:
how tall may a form be, and who decides where forms go.

## Which pillar is at stake

**Geometry is grammar** (pillar 2) and **teach through the body** (pillar 4). A taller form is only
legal if its shape still predicts its behaviour. The risk of raising the ceiling is a mass that looks
climbable and is not, or a summit reachable only by a route the shape does not advertise.

## Decisions

1. **`TERRAIN_PEAK_MAX = 8`.** Not an arbitrary bump:
   - 8 is in the preferred dimension set (1, 2, 3, 5, 8, 13, 21, 34, 55).
   - A stair flight is 8–13 risers before a landing is required, so 8 is the tallest form that is
     still **one flight**. Taller needs authored landings, which is a different primitive and a
     later decision.
   - 8u is the "minor marker, readable at 40 cells" landmark tier. Regional monoliths (21–34) and
     world seals (55–89) stay *structures*, not terrain.
   - Sky exposure already courses every unit as a 1u band, so height stays countable at 8; the
     darkest side value is `0.78 − 0.055 × 7 = 0.395`, still clear of the crevice band.

2. **A tall form is broad, and that is the feature.** A 1:1 apron from 8 costs 8 cells of run on
   every side, so a height-8 landmark is about 19 cells across. This is the honest price of "a slope
   is a staircase", and the research says the same thing: a real butte has a talus apron of shed
   debris at exactly that role. The apron *is* the scree slope. Nothing is a sheer unclimbable mass,
   so nothing lies.

3. **Three authored form primitives, one write site.** All in `terrain.ts`, all staircase-legal by
   construction:
   - `bench(cx, cz, halfW, halfD, top, tread)` — flat top with a staircase apron. A zero-size core
     is a peak, a thin core is a ridge, a wide core is a mesa or ziggurat. `tread` is the run per
     1-unit rise: 1 service, 2 grand, 3 processional.
   - `terracePool(cx, cz, halfW, halfD, rimTop, steps)` — stepped basin. Every ring is ±1, so the
     floor is exitable both ways: a pool, never a pit.
   - `terraceHill(cx, cz, peak)` — retained, now `bench` with a zero-size core.

4. **Landmarks are authored; noise only dresses the ground between them.** `blank-plan.ts` names
   every district and POI. This is the documented level-design order — decide where the encounter
   lives, then grow the space outward — and it is why the skyline reads as intended rather than as a
   seed. Noise-scattered filler is capped at `TERRAIN_FILLER_PEAK_MAX` (5) so it can never
   out-silhouette a named place.

5. **Every district is measured from a real landform**, and the measurement is recorded beside it so
   a later edit is checked against the source rather than against taste. Scale is 1 cell ≈ 2 m.

   | District | Real reference | What the grammar borrows |
   |---|---|---|
   | The Cotton Castle | Pamukkale travertines, Türkiye | Two plateau levels, terrace-mound pools cascading between them, steps 1–6 m, fissure ridges |
   | The Mittens | Monument Valley, Arizona/Utah | Caprock mesas and buttes with talus aprons; a butte is taller than wide, a mesa broader |
   | The Watchers | Monument Valley sentinels | Paired silhouettes staging the gauntlet approach |
   | The Ifugao Steps | Banaue rice terraces, Philippines | Contour benches, ~2 m walls, 6–7 m paddies → `tread: 3` |
   | The Grikes | Burren limestone pavement, Ireland | Clint blocks split by grike fissures, N–S grain dominant, E–W weaker |
   | The Ziggurat | Great Ziggurat of Ur, Iraq | 64 × 46 m stepped platform → 29 × 19 core, grand 1:2 stair |
   | The Delta | Okavango Delta, Botswana | Braided distributaries, seasonal swamp, sand islands |
   | The Causeway | Giant's Causeway, N. Ireland | Flat-topped columns stepping down into water |

6. **Drainage is what makes it cohere.** The water source is the high north-west plateau; it
   cascades south-east through the pools, crosses the pavement, and spreads into the delta. One
   consistent vertical direction — *downhill is south-east* — satisfies directional legibility, and
   it is why the districts read as one place instead of a sampler.

7. **Gaps never open in an apron.** A gap cut into a staircase could sever the only route to a
   summit, and proving its absence per layout costs more than forbidding it.

8. **Terrain columns are instanced per height band.** The bake raises 24,170 cells; a mesh per
   column is not a budget question but a hard failure. Nine instanced draws replace it.

## Consequences

- Pinned socket proofs are unchanged: start→shrine 7, start→socket 20, socket→glyph 5, socket
  fire-down 15 vs arrive 13, chasm roll-only 29 vs leap 13. The reserve is what protects them.
- New proofs: apron steps 1 per cell from 8 to flat · a bench top is flat and its corner steps once ·
  tread 3 holds a terrace for 3 cells · a pool floor sits below its rim and is exitable both ways ·
  every stamped height is an integer in 0..8 · all 1,169 bench tops, 8 pool floors and 15 named
  places roll-reachable from start.
- New tool: `npm run terrain:audit` reports raised cells, height bands, stranded cells, orphans, and
  the POI cadence against the 211-cell ceiling. Widest hop on seed 1 is 208 cells.
- `validatePlan()` rejects an authored form that leaves the floor, enters the gauntlet reserve,
  crosses the shrine spine, or crowds a special — with a message naming the form and the offence. It
  caught a POI label placed on the sealed door during this work.

## What was deliberately not done

- **No landings, so no form above 8.** A form taller than one flight needs authored landings; that
  is a separate primitive and a separate decision.
- **No sheer masses.** A 2 × 2 pier at height 8 would read as a wall both ways, which is legal
  grammar, but it strands its own cells with no ±1 neighbour and would force weakening the no-pits
  proof. Rejected: the proof is worth more than the silhouette.
- **Camera occlusion at height 8 is unresolved.** The camera consumes resting ground height and
  linear roll progress and that policy is untouched, but a height-8 mass between the camera and the
  cube can occlude. Flagged for the camera owner; not silently patched here.
