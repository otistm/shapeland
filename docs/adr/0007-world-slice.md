# ADR 0007 — Occupancy is not a mesh, and E stays EQUIP

Status: Accepted

## Context

Phase 5 stamps the vertical-slice world: shrine, chasm, sentry gauntlet, fire-down socket, sealed
chamber, lightning glyph, and the Keeper. The prototype taught two load-bearing lessons that must
not regress: structure meshes were once built from every occupied cell (pyramids grew ink boxes),
and E was stolen for SPEAK so EQUIP had no key.

## Decisions

1. **`Terrain.wall` is structure only.** Meshes derive from that set. Sentries, the Keeper, and the
   closed door occupy through `World.occupied`, never `setWall`. Death frees a sentry cell without
   tearing down a wall mesh.
2. **The shrine teaches fire.** A grounded land on the shrine stamps Fire onto the down face and
   sets the respawn anchor. Missing saves no longer sandbox-grant the three elementals.
3. **E stays EQUIP.** SPEAK is its own button, shown when Chebyshev-adjacent to the Keeper.
   Dialogue is a UI modal (`onModal` holds the input mask at 0). Space / Enter / tap advance lines.
4. **Socket proof is a BFS.** `solveMoves > arriveMoves` and `solveMoves ≤ arriveMoves + 6` over
   `(cell × orientation)` with fire on the down face after the shrine stamp. Sentries never sit on
   the socket column `x=0`.
5. **Hills use `terraceHill` / `raiseRect`.** Those are the only sanctioned height writers besides
   tests. Phase 6 owns sky-exposure readability shading of stacked units; Phase 5 draws simple toon
   boxes so the critical path can ship.

## Consequences

- World-layer hashes include slice fields, so idle goldens regenerate even for the empty world.
- `apps/web` boots `SLICE_CONTENT` with `slice: true`. The default `World` stays empty so the idle
  corpus still replays the blank lattice.
