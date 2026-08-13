# Shapeland

An open world adventure RPG in the browser. The player is a rolling cube with equippable elemental
faces, exploring a white grid world through an Elden Ring lens: adventure, discovery, enemies whose
shapes ARE their behavior, and color returning to the world where the player has been.

Built by a team of AI agents. Phase 1 is in place: a WebGPU-first toon renderer, the canonical
camera, a white grid, and a cube with baked Normal faces, on top of the Phase 0 deterministic tick.

## Develop

```bash
corepack enable
pnpm install
pnpm dev          # toon cube on the white grid at http://localhost:5173
pnpm test         # unit tests, proofs, camera/toon/palette suites, replay
pnpm e2e          # Playwright smoke (append ?gl=1 to force WebGL2)
pnpm prove        # cube-group proof runner
pnpm replay --check packages/tools/corpus/idle-240.json
pnpm lint
pnpm typecheck
pnpm build
```

If `corepack enable` cannot write into the Node install (common on Windows), use `npx pnpm@9.15.4` in place of `pnpm`.

CI builds a preview on every PR under `/previews/<n>/`. Enable GitHub Pages from the `gh-pages` branch once so those URLs resolve.

A run is `(seed, contentHash, inputLog)`. That triple is the bug-report format.

## Start here

| Document | What it is |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | Vision, pillars, architecture contract, canonical constants, design ledger, build order |
| [docs/TOOLS-PLAN.md](docs/TOOLS-PLAN.md) | The helper tools to build, in priority order, with Phase 0 exit criteria |
| [docs/kb/README.md](docs/kb/README.md) | Knowledge base index — nine research-backed domain references |
| [docs/vertical-slice-plan.md](docs/vertical-slice-plan.md) | The proven vertical slice specification |
| [prototype/vertical-slice.html](prototype/vertical-slice.html) | The working single-file slice that verified every system |

## Pillars

1. **Movement and ability selection are the same verb.** Rolling to a cell decides what is armed on
   arrival. Nothing else selects abilities.
2. **Geometry is grammar.** A shape's form predicts its behavior with zero tutorialization, and must
   never lie.
3. **The world is white; color is memory.** Color is always earned, never decorative.
4. **Teach through the body.** Rules are learned physically before they are ever named in text.

Influences: Hidetaka Miyazaki (FromSoftware), Hideo Kojima, and geometry.

## Stack

pnpm monorepo · TypeScript strict · WebGPU-first via Three.js with WebGL2 fallback · materials in
TSL · deterministic fixed-timestep ECS sim with seeded RNG and input-log replay · Vitest, fast-check,
Playwright, golden-image visual regression, and WASM provers.

Packages have hard boundaries: `sim` (pure, deterministic, zero DOM) · `render` · `content` · `ui` ·
`platform` · `tools`.

## Role skills

Twenty-three role skills live in `.cursor/skills/`. Each is the applied form of a charter in
[docs/kb/roles.md](docs/kb/roles.md). Invoke one by name to work in that discipline.

**Direction and design** — `game-director` · `game-design-lead` · `level-design-lead` ·
`world-building-lead` · `combat-design-lead` · `boss-design-lead` · `narrative-design-lead` ·
`ui-design-lead` · `product-management-lead`

**Engineering** — `architecture-lead` · `programming-lead` · `physics-engineering-lead` ·
`level-design-engineer` · `combat-engineer` · `technical-designer` · `tools-engineer`

**Art and audio** — `art-lead-3d` · `vfx-lead` · `animation-lead` · `motion-graphics-lead` ·
`cad-development-lead` · `audio-engineering-lead`

**Quality** — `qa-lead`

Always-on rules in `.cursor/rules/` carry the pillars and the invariants no change may break.

## Verify the math

```bash
node tools/verify-cube-group.mjs
```

Generates and proves the cube's 24-orientation rotation group, the roll and pivot tables, the parity
theorem (only 12 of 24 orientations are reachable at any cell, which is why PIVOT is mandatory), and
a 19×19 BFS over the full `(cell × orientation)` state space. This is the executable form of
[docs/kb/geometry.md](docs/kb/geometry.md) §1.
