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
4. **Interiors are 2.5D and open to the sky.** The sim is a heightmap plus occupancy, not a voxel
   volume. Courts, keeps, hypostyle naves, and Habitat terraces are enterable. Roofs you walk *under*
   are deferred — they need a ceiling layer and would break the camera's resting-height contract
   without a separate interior rig.
5. **Kit of parts, not one-off geometry.** `keep`, `ring`, `hypostyle`, `salk_court`, `habitat`
   in `packages/sim/src/structure.ts`. Dimensions from `docs/kb/architecture-and-construction.md`
   §7: doors 3 / 5, halls 13×21, piers 7d–10d, spacing ~3d, flights 8–13.
6. **Each main POI gets one speaking solid** (architecture parlante):
   | Place | Solid | Reference |
   |---|---|---|
   | The Watchers | paired keeps, 21u, 3-cell public doors facing the axis | Boston City Hall massing; refuge then prospect |
   | The Cotton Castle | two 21u bars, court open to the horizon, water rill | Salk Institute |
   | The Ziggurat | 21u ring on the existing 1:2 plinth, monumental south gate, north closed | Kahn, Jatiya Sangsad Bhaban |
   | The Causeway | hypostyle 13u piers, nave on the centre axis | Giant's Causeway + Karnak grain |
   | The Sentinel | offset Habitat modules: terrace you climb, keep you enter | Habitat 67 |
7. **Mittens, Ifugao, Grikes, Delta stay landforms.** Their grammar is already honest (butte, terrace,
   pavement, braid). Do not dress them as buildings.
8. **Camera occlusion samples `max(height, pierHeight)`.** A 21u pier on the +Z look vector is an
   integer column. No traversal shake.

## Consequences

- The ziggurat fire-down pin is re-proved after the ring is stamped. Arrive cost may grow by the
  walk from the south gate to the socket; hollow-trap (solve === arrive) is still forbidden.
- `validatePlan` rejects a structure that leaves the floor, enters `SLICE_RESERVE`, or crowds a
  gauntlet special. The ziggurat socket is *inside* its ring and is not a crowding offence.
- Render instances piers per visual height (ink toon, stack bond — made, not found). Terrain
  columns skip pier cells so the mass is one object.
- No-pits continues to apply only to the heightmap.

## What was deliberately not done

- **No roofs, no multi-storey section.** Open sky is the honest 2.5D interior.
- **No 34u vault, no 55u world seal.** One gold-standard regional monolith height first.
- **No analog brutalist meshes.** Integer cells, TSL/toon only.
