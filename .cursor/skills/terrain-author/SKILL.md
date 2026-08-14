---
name: terrain-author
description: Authors Shapeland integer terrain through the terrace-site generator. Use when generating or restamping heightmaps, The Blank, hills, gaps, terraceHill sites, the terrain viewer, or when the user mentions the dungeon terrain map generator.
---

# Terrain author

Noise proposes **sites**. `terraceHill` authors **form**. Water, swamp, and grass are surface kinds,
never height-band tints. Never paste analog heightmaps into sim.

## When this skill applies

Generating, previewing, or restamping grid terrain; editing `blank-stamp.ts`; running `apps/terrain`;
porting an external heightmap tool into Shapeland.

## Rules

1. Integer heights only. Peak ≤ `TERRAIN_PEAK_MAX` (8); noise filler ≤ `TERRAIN_FILLER_PEAK_MAX` (5).
2. Write heights only through `bench` / `terracePool` / `terraceHill` / `raiseRect` /
   `Terrain.setHeight` in `terrain.ts`. A tall form is broad: a 1:1 apron from 8 costs 8 cells of run
   per side, which is the talus slope that makes the summit climbable. Never author a sheer mass.
3. Gaps via `setGap`. Water via `setWater`. Swamp via `setSwamp`. Grass via `setGrass`. Walls via
   `setWall` for structure, never for sentries or the Keeper. A gap clears water/swamp/grass. Height
   and surface kind are independent.
4. Keep 2-cell air around start, shrine, sockets, doors, pickups, NPCs, sentries, and gap rows.
5. Keep the shrine spine flat: `|x| ≤ 1`, `z ∈ [-8, 1]`. Keep `SLICE_RESERVE` clear of Blank noise.
6. After a restamp run `npm run prove`. Socket pins stay unless Level Design Lead records new ones.

## Landmarks are authored, not seeded

Named places live in `packages/tools/src/blank-plan.ts`, each measured from a real landform with the
measurement recorded beside it. Noise only dresses the ground between them. Add a district by adding
`bench` / `terracePool` sites and POIs there, then run `validatePlan()` — it rejects a form that
leaves the floor, enters the gauntlet reserve, crosses the shrine spine, or crowds a special.

Buildings are the structure kit in `packages/sim/src/structure.ts`, not taller benches. Civic mass
uses 2-cell shells, cave gates, service cores, and 13/21 height hierarchy. Skill:
`brutalist-architecture`. `docs/kb/architecture-and-construction.md` §8. Do not dress a butte as a
building.

## Workflow

1. `npm run terrain` to preview a seed, or `generateBlank(seed)` in `@shapeland/tools`.
   `npm run terrain:audit` reports height bands, stranded cells, orphans, and POI cadence.
2. Write hills/gaps/water/swamp/grass to `packages/sim/src/blank-stamp.ts` via
   `npm run terrain:gen -- --seed=N --ts --out=packages/sim/src/blank-stamp.ts`.
   The bake is 320 × 320 (`FLOOR_SIZE`). Do not emit a 1000² analog map or a 3200×320 strip.
3. Assert `generateBlank(BLANK_STAMP_SEED)` equals that file (`terrain-gen.test.ts`).
4. `npm run prove` and the world/terrain test files.

Usage: `docs/tools/terrain.md`. Decisions: `docs/adr/0012-terrain-generator.md`,
`docs/adr/0013-water-swamp.md`, `docs/adr/0014-grass.md`,
`docs/adr/0015-peak-eight-and-the-authored-blank.md`.
