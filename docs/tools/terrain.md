# Terrain generator

Attacks **authoring throughput** (TOOLS-PLAN item 4). Designers and agents author named districts and
let noise dress the ground between them, instead of hand-listing `terraceHill` calls. Water, swamp,
and grass are surface kinds, not height bands.

## The Blank as it stands

Eight districts, each measured from a real landform, bound together by one drainage story: the water
source is the high north-west plateau, it cascades south-east through terraced pools, crosses a
limestone pavement and spreads into a delta. Downhill is always south-east.

| District | Real reference |
|---|---|
| The Cotton Castle | Pamukkale travertines, Türkiye |
| The Mittens | Monument Valley, Arizona/Utah |
| The Watchers | Monument Valley sentinel buttes |
| The Ifugao Steps | Banaue rice terraces, Philippines |
| The Grikes | Burren limestone pavement, Ireland |
| The Ziggurat | Great Ziggurat of Ur, Iraq |
| The Delta | Okavango Delta, Botswana |
| The Causeway | Giant's Causeway, Northern Ireland |

## Run

```
npm run terrain          # canvas viewer at http://127.0.0.1:5174
                             # Regenerate advances the seed; type a seed and Enter to jump.
npm run terrain:gen      # print the Blank stamp for seed 1
npm run terrain:gen -- --seed=7 --out=stamp.json
npm run terrain:audit    # height bands, stranded cells, orphans, POI cadence vs the 211 ceiling
npm run prove            # after any restamp
```

## Contract

- Integer heights. Terrain peak ≤ 8 (`TERRAIN_PEAK_MAX`); noise filler ≤ 5. Structure piers
  (`setPier`) are occupancy with visual height ≤ 21 (`STRUCTURE_PEAK_MAX`) — they are not a
  walkable heightmap value and do not grow an apron (ADR 0017).
- Form is `bench` / `terracePool` / `terraceHill` / `raiseRect` for landforms, plus the structure
  kit (`keep`, `ring`, `thickRing`, `fill`, cave openings, fins, `hypostyle`, `salk_court`,
  `habitat`) for interiors at castle / cathedral / shack scale. Civic shells are 2 cells;
  cores are distinct towers; entries compress then release. Near-side piers cut away in
  render. No analog slopes. Skill: `brutalist-architecture`.
- A tall *landform* is broad. A 1:1 apron from 8 costs 8 cells of run per side. A tall *structure*
  is a pier you walk into or around. No roofs: interiors are open-sky courts (2.5D). Floating
  cantilevers are a grammar lie — express lift as oversized piers and colonnade voids.
- Named places are authored in `packages/tools/src/blank-plan.ts`; noise only fills between them.
- Gaps never open in an apron: one could sever the only stair to a summit.
- The bake is the floor mesh: 320 × 320 cells (`BLANK_X0..BLANK_X1`, `BLANK_Z0..BLANK_Z1`).
- `SLICE_RESERVE` (gauntlet + chamber + 2-cell air) stays clear of Blank hills, gaps, water, swamp,
  grass.
- Chasms are `Terrain.setGap`, not height −1 in sim.
- Water is `setWater`. Swamp is `setSwamp`. Grass is `setGrass`. None is a height tint. Mutually
  exclusive with `gap` and with each other.
- The shrine spine (`|x|≤1`, `z ∈ [-8,1]`) and specials keep air. Layout changes re-run socket BFS.
- Committed bake: `packages/sim/src/blank-stamp.ts` must equal `generateBlank(BLANK_STAMP_SEED)`.

## Restamp The Blank

1. Pick a seed in the viewer. Confirm the north corridor to the shrine is still flat.
2. `npm run terrain:gen -- --seed=N --ts --out=packages/sim/src/blank-stamp.ts`
3. `npm run prove` — start→shrine 7, start→socket 20, socket fire-down 15 vs 13 must stay unless
   Level Design Lead records new pins.
4. Commit the stamp with the generator change. A bake that cannot be regenerated is a fork.

## What was cut from the sketch tool

Gemini, 50-high noise, **height-as-water tints**, 1000×1000 analog maps, PNG greyscale as sim input.
A 3200×320 strip is the same class of analog field and is cut; the legal bake is 320 × 320 sites.
Water, swamp, and grass returned as legal surface kinds (ADR 0013, ADR 0014): wet footing refuses
jump; swamp slows rolls; grass speeds rolls; TSL sheets live in render only.
