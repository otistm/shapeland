# ADR 0017 — Structures are occupancy you enter, not terrain you climb

Status: Accepted

Verdict: **proceed**

## Context

The Blank's named places were all `bench` / `terracePool` landforms. A height-8 mesa is an honest
butte; it is a dishonest building. The cube travelled *on* every landmark because the only primitive
was a staircase apron. ADR 0015 forbade forms above 8 until authored landings existed, and forbade
sheer masses because they stranded heightmap cells. Both remain true **for terrain**.

The metrics table already split the skyline: minor markers 8–13u are terrain; regional monoliths
21–34u and world seals 55–89u are *structures*. Colossal brutalism (Kahn's National Assembly and
Salk court, Boston City Hall, Habitat 67, Geisel's stacked mass, the Barbican's layered decks) is
the reference for those monoliths: unrelieved mass, deep reveals, courts you walk into, piers that
prove height by standing in front of something shorter.

## Which pillar is at stake

**Geometry is grammar** (pillar 2) and **teach through the body** (pillar 4). A shape that looks
like a building must admit the cube. A shape that looks like a butte must be climbed. Mixing them
is a lie.

## Decisions

1. **`TERRAIN_PEAK_MAX` stays 8.** Landforms keep one-flight aprons. Noise filler stays ≤ 5.
2. **`STRUCTURE_PEAK_MAX = 21`.** Regional monolith, preferred-set, readable at ~100 cells. 34u
   sealed vaults and 55u world seals are later primitives, not this pass.
3. **Collision data ≠ render data.** A structure cell is `setPier` occupancy. Movement refuses it
   the same way as a slice wall. Visual height lives on the wall map and is *not* a walkable
   heightmap value, so a 21u mass does not require a 21-cell talus and does not strand a summit.
4. **Interiors are 2.5D, open to the sky, and large enough to explore.** The sim is a heightmap
   plus occupancy, not a voxel volume. Every kind stamps a multi-room plan at a referenced place
   scale (castle 21×33, cathedral 33×33, shack 21×17) with ≥ `INTERIOR_MIN` walkable cells,
   BFS-reachable from the cave. Roofs you walk *under* are deferred — they need a ceiling layer
   and would break the camera's resting-height contract without a separate interior rig.
5. **Kit of parts, not one-off geometry.** `keep`, `ring`, `thickRing`, `fill` (cores), cave
   openings, fin recesses, `hypostyle`, `salk_court`, `habitat` in
   `packages/sim/src/structure.ts`. Dimensions from `docs/kb/architecture-and-construction.md`
   §7–§8: doors 3 / 5 with cave compression, halls 13×21, piers 7d–10d, spacing ~3d, flights
   8–13, civic shells 2 cells, height hierarchy 13 / 21. Theatrical cantilevers are out —
   a lifted reading is oversized piers plus colonnade voids. Skill: `brutalist-architecture`.
6. **Each main POI gets one speaking solid** (architecture parlante):
   | Place | Solid | Reference |
   |---|---|---|
   | The Watchers | paired castle keeps, 21×33, 21u, cave gates facing the axis | Boston City Hall / keep |
   | The Cotton Castle | 33×29 Salk campus, court, wing cells | Salk Institute |
   | The Ziggurat | 33×33 cathedral on the 1:2 plinth, monumental south gate, north closed | Kahn, Jatiya Sangsad Bhaban |
   | The Causeway | 33×33 hypostyle nave, 3-wide processional | Giant's Causeway + Karnak |
   | The Sentinel | 21×17 Habitat / shack: terrace you climb, rooms you enter | Habitat 67 |
7. **Mittens, Ifugao, Grikes, Delta stay landforms.** Their grammar is already honest (butte, terrace,
   pavement, braid). Do not dress them as buildings.
8. **Camera cutaway is render-only.** A pier on the camera→cube segment scales to 0 (hysteresis
   1.5 / 2 cells) so the near facade does not hide the cube. Occupancy is unchanged. The camera
   still lifts over *terrain* columns; it does not lift over structure piers — a 21u wall would
   pitch the quarter-turn rig at the sky. No traversal shake.

## Consequences

- The ziggurat fire-down pin is re-proved after the ring is stamped. Arrive cost may grow by the
  walk from the south gate to the socket; hollow-trap (solve === arrive) is still forbidden.
- `validatePlan` rejects a structure that leaves the floor, enters `SLICE_RESERVE`, or crowds a
  gauntlet special. The ziggurat socket is *inside* its ring and is not a crowding offence.
- Render instances piers per visual height (ink toon, stack bond — made, not found). Terrain
  columns skip pier cells so the mass is one object. Near-side piers on the camera→cube
  segment scale to 0 (`pier-cutaway.ts`); occupancy is unchanged.
- No-pits continues to apply only to the heightmap.

## What was deliberately not done

- **No roofs, no multi-storey section.** Open sky is the honest 2.5D interior.
- **No 34u vault, no 55u world seal.** One gold-standard regional monolith height first.
- **No analog brutalist meshes.** Integer cells, TSL/toon only.
