# Helper Tools Build Plan

Shapeland is built by a team of agents. Agents are bottlenecked by exactly two things: **how long
it takes to see the result of a change**, and **how long it takes to reproduce a defect**. Every
tool below exists to attack one of those. Nothing else justifies a tool.

Two findings anchor this plan. John Romero's rule — **"tools live longer than games do"** (most of
the tools he, Sweeney and Norden built are still in use decades later, and none of them expected
that). And InnoGames' finding that their **highest-leverage automation came from watching a designer
hand-shuffle data through four formats** — the win was in an unglamorous step nobody had flagged.

**The agent corollary:** instrument the agent loop itself and count how many turns are spent
re-running a bake, re-finding a repro, or re-deriving a number. That measurement, not intuition,
picks the next tool.

---

## Priority order

Tools are ordered by *iteration-time payback*, not by how interesting they are.

| # | Tool | Attacks | Phase |
|---|---|---|---|
| 1 | Proof runner | correctness feedback loop | 0 |
| 2 | Replay recorder + inspector | defect reproduction | 0 |
| 3 | Golden-image harness | visual regression blindness | 1 |
| 4 | Grid/level editor | content authoring throughput | 1–5 |
| 5 | Budget sentinel | performance regressions | 1 |
| 6 | Content schema validator | data-authoring errors | 2 |
| 7 | Asset baker | build reproducibility | 4 |
| 8 | Balance simulator | tuning without playing | 5 |
| 9 | Telemetry/heatmap pipeline | encounter tuning from reality | 9 |
| 10 | Shape-grammar workbench | bestiary authoring | 9 |

---

## 1. Proof runner — `tools/prove`

**The single highest-value tool in the project.** Shapeland's level design is provable, so proofs
must be cheap enough to run on every content change.

- BFS over `(cell × orientation)`, packed as `(y*W + x)*24 + o`, four successors per state from the
  roll tables. A 256×256 region is ~1.57M states; only ~786K reachable after parity.
- Proves: reachability of every destination and summit, no unexitable pit, and per-socket
  `solveMoves > arriveMoves` and `solveMoves ≤ arriveMoves + 6`.
- **State canonicalization beats every search micro-optimization combined.** The Sokoban insight —
  normalize the player to the topmost-leftmost *reachable* cell, because the reachable region
  defines the state rather than the exact position — collapses enormous equivalence classes. **Find
  Shapeland's analog before tuning the search.**
- **Content-address the proofs.** Cache by `hash(level + rules + prover version)`. Unchanged content
  never re-proves; this is what keeps proofs CI-viable.
- Rust + WASM with SIMD when the TS version stops being fast enough — but see the WASM boundary
  warning below.
- Ships in `@shapeland/tools` for content authors *and* runs as a CI gate. Same binary, both places.

**WASM boundary warning.** `wasm-bindgen`'s automatic marshaling can make a prover *slower than
plain TypeScript*: one published benchmark measured array modification at **1.40ms in JS, 1.62ms
through wasm-bindgen, 0.35ms with raw pointer-passing, and 0.23ms with SIMD**. Allocate the level
buffer inside WASM linear memory and cross the boundary exactly once per proof.

## 2. Replay recorder and inspector — `tools/replay`

Determinism only pays off if there is a tool that spends it.

- A run is `(seed, contentHash, inputLog)`. That triple is the **bug report format** — agents attach
  it instead of prose.
- **Layered per-subsystem state hashes, not one total tick hash.** A single hash tells you *that*
  you diverged; layered hashes tell you *which system*. This is the difference between hours and
  minutes of desync debugging.
- Bisection: binary-search the first divergent tick, then diff field by field.
- Keyframes every N ticks so replays can seek, and so a hash mismatch is recoverable.
- Inspector UI: scrub the timeline, step tick by tick, view the sim state tree, overlay the
  trajectory on the grid, jump to the divergent tick.
- The golden corpus is committed: `(seed, inputLog, expectedTickHashes)` for representative runs.
  Every fixed defect's replay joins it.

## 3. Golden-image harness — `tools/goldens`

The prototype's honest caveat was "logic-verified, visually unverified". This retires it.

- Per-scene captures at fixed seeds: cube at rest, mid-roll, burning, bolt frame, terrain hill, each
  toon band, each threshold.
- Perceptual diff thresholds, not exact pixel equality.
- **Flake in golden-image testing is an environment problem, not a threshold problem.** Pin the
  Playwright Docker image *by version* and generate baselines inside it. **If you find yourself
  raising the diff tolerance repeatedly, that is the signal you have an environment mismatch.**
- **Headless Chromium silently falls back to software rendering for WebGPU without explicit flags.**
  Output is correct but pixel-different, which quietly invalidates every baseline. Note that the
  ecosystem is mid-migration from SwiftShader to software Dawn via Lavapipe, so older guides found
  by searching are already stale.

## 4. Grid / level editor — `tools/editor`

- **Shares the game's real `@shapeland/sim` code.** A tool that reimplements movement will diverge
  from it, and then it lies. This is non-negotiable.
- Authoring surface: paint heights via the sanctioned helpers only (`terraceHill`, `raiseRect`) so
  the one-write-site rule holds; place sockets, sentries, NPCs, pickups, region bounds.
- **Terrace-site generator (first slice):** `apps/terrain` + `packages/tools/src/terrain-gen.ts`.
  Authored districts plus seeded integer filler, peak ≤ 8, committed bake
  `packages/sim/src/blank-stamp.ts`. See
  `docs/tools/terrain.md` and ADR 0012. Do not ingest analog 1000² noise into sim.
- **Live link to a running game**: edit, and the running sim reloads content without losing
  position. This is the single biggest throughput multiplier for level work.
- Undo/redo via the command pattern (each edit is a serializable command), which also gives a
  replayable authoring log.
- **Inline validation**: proofs (tool 1) run on every edit against the touched region, so a
  designer learns a socket is unopenable in seconds, not in review.
- Overlays: reachability mask, parity checkerboard, beat-spacing ruler, occlusion percentage,
  sightline cones, dead-end-without-loot markers.

## 5. Budget sentinel — `tools/budget`

- Per-system frame budget ledger — sim tick, particle compute, shadow pass, UI. **Additions must
  declare their budget line.**
- CI asserts a scripted 60s run holds p95 ≤ 8ms sim + 8ms render on the reference tier.
- Bundle budgets per route; startup-to-interactive budget.
- **Allocation test**: 10k–1e6 ticks with `--expose-gc`, assert steady heap. Back it with a lint rule
  banning object/array literals and `.map/.filter/.slice` in `sim/hot/**` — the lint rule is the
  actual guarantee; the heap test is a canary.
- Regressions block merge.

## 6. Content schema validator — `tools/validate`

- Schema-first authoring (Zod or TypeBox), validated **at build time**, not at runtime.
- Validates: ability definitions, region bounds, dialogue state graphs, terrain authoring calls,
  save-file migrations.
- Catches the narrative-state explosion class of bug — historically a top source of late defects —
  before it reaches a build.
- Save files are never trusted: validate shape, known abilities, and found-gating on load, always.

## 7. Asset baker — `tools/bake`

- Procedural source stays canonical; the bake is reproducible and content-addressed.
- Bakes face canvases, grid tiles, terrain side textures, and decals to **KTX2/Basis**; meshes to
  glTF + meshopt.
- Determinism requirement: same input, same bytes out. A non-reproducible bake makes golden images
  meaningless.
- Immutable caching, so unchanged assets never re-bake.

## 8. Balance simulator — `tools/balance`

- Runs headless sim at speed over parameter sweeps: win probability per encounter per loadout,
  time-to-kill distributions, escape-time margins for every reachable cell against a sentry's
  windup.
- Answers tuning questions without a human playing, and produces the tables that go into review.
- Worst-case modelling (all sentries alive) is allowed but must be **commented as modelling**, with
  the real separation audited in content.

## 9. Telemetry and heatmap pipeline — `tools/telemetry`

- Opt-in, privacy-respecting, aggregate: deaths per cell, socket attempts, ability usage, dwell
  time.
- Renders heatmaps over the grid. Precedent: Ubisoft's DNA Viewer overlaid failure heatmaps on both
  2D maps and 3D geometry; Nintendo's "Game Over View" showed where players died most and directly
  motivated adding autosaves.
- Closes the loop the balance simulator opens: simulated expectation versus measured reality.
- Cheap to start: log position at fixed intervals plus every death.

## 10. Shape-grammar workbench — `tools/shapes`

- For the bestiary. Each non-cube solid needs an explicit movement decision, because **only the cube
  rolls face-to-face on a square grid**.
- Enumerate a candidate shape's symmetry group, its reachable poses per cell, and its rolling graph;
  visualize the resulting movement grammar; export the transition tables.
- Asserts the design contract: **a shape's form must predict its behavior, and must never lie.**
- Every new shape ships its movement-grammar suite from this tool.

---

## Cross-cutting standards

**Tools share the game's code.** Any tool that reimplements sim logic is a future bug. Import
`@shapeland/sim`; never fork it.

**Determinism hazards apply to tools too.** `Math.sin/cos/pow/exp` are not spec-pinned across JS
engines — the sim needs its own trig, and so does anything whose output feeds a proof or a bake.
`Map`/`Set` iteration order and entity-ID recycling are the other two usual suspects.

**Monorepo DX.** pnpm workspaces; boundaries enforced mechanically (dependency-cruiser or eslint
boundaries) rather than by convention; Biome for lint and format with a no-warnings policy on `sim`.
Note that **Turborepo's own docs recommend against TypeScript project references** — they add a
second caching layer that fights Turbo's. Per-package `tsconfig.json` with no root one gives better
cache granularity.

**Every tool ships with error messages and a usage doc.** A tool whose failure mode is a stack trace
costs more than it saves. This is the documented top failure mode of the discipline.

**Instrument the tools.** Log invocation counts and failure rates. A tool nobody runs is either
broken or unnecessary, and the telemetry tells you which.

---

## Phase 0 exit criteria

Before any game feature is built, these must exist and be green in CI:

- [ ] Fixed-timestep sim loop, seeded RNG, byte-identical replay
- [ ] Proof runner with the cube-group assertions from `tools/verify-cube-group.mjs` promoted into it
- [ ] Replay recorder producing `(seed, contentHash, inputLog)` bug reports
- [ ] Layered per-subsystem state hashing
- [ ] Golden corpus with at least one committed run
- [ ] Budget sentinel with the allocation test wired
- [ ] Package-boundary contract tests
- [ ] Preview deploy on every PR

---

## Related

- [kb/engines-and-tools.md](kb/engines-and-tools.md) — the full research brief with benchmarks and
  library tradeoffs
- [kb/physics.md](kb/physics.md) — determinism engineering, state hashing, physics testing
- [kb/geometry.md](kb/geometry.md) — the roll tables and BFS state packing the proof runner uses
- [DESIGN.md](DESIGN.md) — architecture contract and build order
