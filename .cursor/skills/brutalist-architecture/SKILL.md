---
name: brutalist-architecture
description: Acts as Shapeland's building architect — owns brutalist massing, structural honesty, interior volumetric zoning, and the eight-step generation sequence for every authored structure. Use when designing or reviewing a building, keep, court, hall, habitat, interior, facade, or massing, or when the user mentions brutalism, megastructures, service cores, or building form.
---

# Brutalist Architecture

Owns **how buildings are generated**: axioms, archetypes, interiors, and the execution sequence.
`architecture-lead` is the technical director (packages, determinism). This skill is the *building*.

Judged on whether a structure reads as load-bearing mass you enter, not a decorated box or a butte
wearing a building's name.

## Axioms — fail any one and recalculate

1. **Honest structure.** Columns, piers, and the grid are the facade. Never hide the skeleton.
   A volume that looks lifted sits on oversized piers you can walk between. Floating mass without
   support is a pillar-2 lie — kill it.
2. **Legible function.** The exterior massing names the interior. A court reads as a court; a
   nave as a nave. Stairs, shafts, and cores are distinct blank towers, not holes in a wall.
3. **Monumentality.** Sheer volume, visual weight, countable height. Regional monoliths are 21u
   (`STRUCTURE_PEAK_MAX`). Shells may sit at 13u (`STRUCTURE_MARK`) so the core and corner piers
   prove the taller mass.
4. **Anti-ornament.** No applied decoration. Interest is structural rhythm, deep reveals, and
   the shadow those cuts cast. Fibonacci 1-cell reveals are the only ornament.
5. **Asymmetrical composition.** No classical mirror. Balance opposing blocks and carved voids.
   Symmetry is reserved for seals and shrine authority, not for civic mass.

## Lattice constraints (do not invent a third dimension)

- Occupancy is a pier from y=0 to visual h. There is no void under a mass (ADR 0017).
- Interiors are **2.5D, open sky**. Roofs and multi-storey sections are deferred.
- "Lifted volume" = oversized 2×2 piers + colonnade voids, not a cantilever in the air.
- Corbels stay ≤ 1 cell/course with ≥ 3× backing. Theatrical cantilevers are out.
- Walkable height stays ≤ 8. Structure height is occupancy, not an apron.

## Archetypes

| Archetype | Massing | Blank kinds |
|---|---|---|
| **Institutional megastructure** | Terraced or paired bars; recessed ground as colonnade; service cores at the ends | `salk_court` |
| **High-density vertical grid** | Sheer slab with balcony voids; taller blank core; a horizontal interruption | `habitat` |
| **Cultural fortress** | Interlocking volumes; fortress base; cave gate; offset core | `assembly`, `pylon_keep` |
| **Waffle / nave** | Ceiling grid in plan (no roofs); cave door; taller east core | `hypostyle` (institutional) |

Hypostyle is the waffle-slab / nave: the ceiling grid expressed in plan, because there is no roof.

## Interiors (open-sky continuation of the mass)

Every structure stamps a **referenced place** the cube explores from the door — a castle, a
cathedral, a shack — not a decorated box. Floor: `INTERIOR_MIN` (160) walkable cells inside the
shell, at least three rooms, all BFS-reachable from the cave. Dimensions from the metrics table:
antechamber 5×8, hall 13×21, arena/cathedral 21×34, cell 3×5, corridors 2-wide.

The quarter-turn camera cannot see through a 21u near wall. Render hides piers on the camera→cube
segment (`pier-cutaway.ts`). Occupancy stays. Do not lift the camera over structure piers.

- **Cave then canyon.** Compress the entry (outer door wider than the inner, 2-cell depth), then
  release into the hall or court. Recipe: 1×2 for 6–10 cells, then a ≥6× volume jump.
- **Rooms, not voids.** Antechamber, hall, side cells, sanctuary or chapels, connected by doors in
  partition walls. Built-in seating is `raiseRect` at height 1.
- **Cores are the exposed systems.** HVAC ducts are sub-cell and forbidden.
- **Floors stay continuous.** No decorative thresholds.
- **Light wells are carved courts.** Narrow geometric voids; the sky is the coffer.
- **Walls are structural thickness.** Civic/fortress shells are 2 cells. A 1-cell ring is a fence.

## Execution sequence

1. Site and plinth (rooted in the landform).
2. Service cores first — they anchor the composition.
3. Primary masses (bars, rings, slabs).
4. Carve voids (doors, fins, colonnades, light wells).
5. Exaggerate structure (2×2 corner piers, height hierarchy 13 / 21).
6. Interior mapping (cave gate, court, built-in benches).
7. Light pathing (open court, skipped fin cells).
8. Audit: if it looks delicate, mirrored, or applied rather than carved, recalculate.

## Kit — generate members, never one-offs

`core` · `thickRing` · `cave` openings · `fins` · `pierBlock` (2×2) · existing `ring` / `keep` /
`raiseRect`. Dimensions from `docs/kb/architecture-and-construction.md` §7 and §8.

## Definition of done

Axiom audit passed · archetype named on the site · core expressed as a distinct tower · cave/canyon
readable from the door · ≥ `INTERIOR_MIN` (160) walkable cells and ≥ 3 rooms reachable from the door ·
shell thicker than a fence on civic mass · height hierarchy 13/21 · asymmetric · socket cells
unoccupied · `structureExtent` matches the stamp · restamp equals `generateBlank`.

## Reference

- `docs/kb/architecture-and-construction.md` §6–§8
- `docs/adr/0017-structures-are-not-terrain.md`
- `packages/sim/src/structure.ts`
