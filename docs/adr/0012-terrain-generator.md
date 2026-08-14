# ADR 0012 — Terrain sites are proposed; Chebyshev terraces are authored

Status: Accepted

## Context

A dungeon heightmap generator (AI Studio canvas: simplex noise, peaks to 50, chasm = −1, JSON/PNG
export) is useful as a *site proposer*. Dropping it into Shapeland unchanged would break the
quarter-turn invariant's terrain rules: analog slopes, peaks above 3, decorative water tints, and a
live noise field that sim cannot consume.

## Decisions

1. **The generator lives in `@shapeland/tools` and `apps/terrain`.** It imports `@shapeland/sim`. It
   does not fork movement, occupancy, or `terraceHill`.
2. **Noise proposes sites; the sanctioned helpers author form.** Output is integer peaks
   `1..TERRAIN_PEAK_MAX` plus optional 1-cell gaps. No ramps, no sub-cell height, no Gemini, no
   simplex in sim. Superseded in part by ADR 0015: the ceiling is now 8, form comes from `bench` /
   `terracePool` / `terraceHill`, and **named landmarks are authored** rather than proposed — noise
   only dresses the ground between them.
3. **The Blank bake is committed.** `generateBlank(BLANK_STAMP_SEED)` must equal
   `packages/sim/src/blank-stamp.ts`. Changing the algorithm without restamping and re-proving is a
   regression. The bake covers the floor mesh: `FLOOR_SIZE` × `FLOOR_SIZE` cells (320 × 320). The
   authored gauntlet lives in `SLICE_RESERVE`; Blank noise does not terrace, gap, or wet that box.
   The gauntlet hill `(-7,-16,2)` stays slice structure, not Blank noise. This is not a 1000×1000
   analog heightmap.
4. **The shrine spine stays flat.** `|x| ≤ 1`, `z ∈ [-8, 1]`, plus 2-cell air around start, shrine,
   Keeper, and the chasm row. Socket BFS pins must stay green after a restamp.
5. **Color is not a height legend in-game.** The tool may tint stacked cubes for authoring. The world
   stays white; sky-exposure (ADR 0008) is the in-game read. Water, swamp, and grass are **surface
   kinds** (ADR 0013, ADR 0014), not height-band tints.

## Consequences

- `npm run terrain` is the viewer. `npm run terrain:gen` prints the stamp. Agents restamp by writing
  `blank-stamp.ts` and running `npm run prove`.
- Open-world districts will use the same bake path; they do not get a 1000×1000 analog heightmap.
  Expanding the stamp means more integer terrace *sites* on the floor mesh, never a denser analog
  field.
