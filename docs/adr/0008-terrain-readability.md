# ADR 0008 — Sky-exposure albedo makes stacked units readable

Status: Accepted

## Context

Phase 6 is terrain: the construction helpers already stamp integer terraces, but an all-white
column is invisible against its own top. With the key light at 52°, a horizontal top and a
sun-facing side land in the same toon band, so lighting alone cannot show a staircase. The
prototype baked **sky exposure** into albedo — a physical stand-in for ambient occlusion.

## Decisions

1. **Heights stay integers.** `terraceHill` / `raiseRect` remain the only sanctioned writers.
   `setHeight` lives in `terrain.ts`; production code does not call it elsewhere. Peak clamps at 3.
2. **Albedo carries the edge.** Tops stay 1.00 (the world stays white). Vertical faces are 0.78.
   Each stacked unit darkens by 0.055 below the summit, with a ×0.86 crevice at the unit base.
   Contrast of the lit-side edge is ~1.27:1 and the shaded edge ~1.97:1; adjacent courses differ
   by 7%.
3. **Ground-coupled presentation reads `Terrain.height`.** Pickups, sentries, telegraphs, and the
   Keeper sit on the column they occupy. Sim already stores integer `h`; scorch already stores
   `scorchH`. The camera still consumes resting ground height (`destY` / `player.y`), never the
   roll lift, eased at `CAM_CLIMB 4.5`.
4. **Critical-path numbers are pins.** Start → shrine 7, socket arrive 13 / solve 15, leap 13 vs
   roll-only 29. Hills sit off that path; a proof failure here is a layout regression.

## Consequences

- Terrain boxes use a six-slot toon material (shared top map, per-height side map). Phase 5's
  unshaded white boxes are gone.
- The empty-world idle corpus is unchanged: default `World` still has no heights.
