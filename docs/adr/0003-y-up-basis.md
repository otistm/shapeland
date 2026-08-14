# ADR 0003 — Y-up change of basis

Status: Accepted

## Context

Sim orientation is Z-up (`docs/kb/geometry.md`): face `0=+Z` is up, and `upFace(i) = i >> 2`.
Three.js is Y-up. The camera sits at `CAM_OFFSET (0, 10.12, 19.53)` looking toward −Z, so screen-up
is world −Z.

## Decision

The change of basis from sim to game is **Rx(−90°)**:

`(x, y, z)_sim → (x, z, −y)_game`

- Sim up (+Z) → game up (+Y)
- Sim east (+X) → game east (+X)
- Sim north (+Y) → game north (−Z)

Cardinals in `@shapeland/sim` match that mapping: **N = −Z, S = +Z**. Keyboard W is north.

Render converts `orientationMatrix(i)` through this conjugation to a quaternion. Sim never stores
quaternions. BoxGeometry groups stay `+X,−X,+Y,−Y,+Z,−Z`; the body-face → group table is:

`[2, 3, 0, 1, 5, 4]` (sim +X, −X, +Z, −Z, −Y, +Y).

## Consequences

- Agents must not invent a second indexing in render.
- A roll north changes `z` by −1 and still flips `(x+z)` parity.
