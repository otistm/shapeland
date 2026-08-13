# ADR 0001 — Phase 0 scaffolding decisions

Status: Accepted

## Context

Phase 0 has to exist before any game feature: a pnpm monorepo that ticks deterministically, replays
byte-identically, proves the cube group, and deploys a preview on every PR.

## Decisions

1. **Orientation indexing follows `docs/kb/geometry.md`, not Three.js `BoxGeometry` groups.** Sim
   faces are `0=+Z, 1=−Z, 2=+X, 3=−X, 4=+Y, 5=−Y` so `upFace(i) = i >> 2` and `opposite(f) = f ^ 1`.
   Floor parity uses `(x + z)` because world Y is height. Render remaps this integer to a Y-up
   quaternion in Phase 1. The vertical slice's BoxGeometry order stays a render concern.
2. **No TypeScript project references.** Per-package `tsconfig.json` with `noEmit`, consumed as
   source via `exports`. Matches the tooling-plan note that a second TS cache fights the monorepo.
3. **The Phase 0 app is vanilla TypeScript, not React.** The HUD is a game shell. React stays out
   until UI actually needs a component tree.
4. **Three.js is deferred to Phase 1.** The Phase 0 presenter clears a 2D canvas white and
   interpolates snapshots. That is enough to prove the sim/render split without pulling the GPU
   stack into the scaffolding gate.
5. **Preview deploys target GitHub Pages.** Main ships at the site root; pull requests ship under
   `/previews/<n>/`. Vite `base` is `./` so both layouts work. Pages must be enabled on the
   `gh-pages` branch once.

## Consequences

- Agents must not invent a second orientation table in render.
- Adding a package requires updating the boundary contract test in the same change.
- Golden images wait for Phase 1; Phase 0 pins behavior with replay hashes, not pixels.
