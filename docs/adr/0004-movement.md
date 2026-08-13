# ADR 0004 — Movement lives in sim; visual ease lives in render

Status: Accepted

## Context

Phase 2 ports roll, jump, leap, buffer, pivot, and refusals from `prototype/vertical-slice.html`.
Sim must stay integer-tick and transcendental-free. The camera must consume linear roll progress
and resting ground height, never the eased cube.

## Decisions

1. **Authoritative pose is `{cell, orientation, mode, phase, dir}`.** Landing snaps from move
   *start* using table lookups. Quaternions, `rollEase`, and the sine lift arc exist only in
   render, derived from the snapshot.
2. **A leap equals two rolls** in cell and orientation, asserted with exact integer equality over
   all 24 orientations × 4 directions. Occupancy may refuse the path; the geometric identity does
   not care.
3. **PIVOT is an in-place roll**, not vertical yaw. Yaw (`YAW(i)`, `Rz90`) is the algebraic odd
   generator in the cube-group proof. The verb the player uses applies `rollToward` without
   translation, so an isolated cell reaches all 24 orientations and all 6 down faces. That is what
   the corridor lock requires.
4. **Squash is render-only.** Sim pulses `FLAG_REFUSE` / `FLAG_LAND` / `FLAG_LAUNCH`; the spring
   never writes camera shake.
5. **Flight duration is `FLIGHT_TICKS = 86`** (120Hz hang-zone integrator), matching
   `FLIGHT_DUR ≈ 0.72`. Horizontal leap progress is `phase / FLIGHT_TICKS`; vertical landing is the
   `+ - * /` integrator.

## Consequences

- Terrain stays flat in the default world; walls, gaps, and integer heights are injected by tests
  and by the Phase 5 slice stamp. Phase 6 owns sky-exposure readability of those heights.
- Golden idle hashes change because the player layer now includes move state.
