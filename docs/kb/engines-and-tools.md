# Making Digital Tools and Game Engines — Research Brief for Shapeland

## 1. Data-Oriented ECS Design

**Storage models.** Three families dominate: **archetype/table** (Unity DOTS, Bevy, flecs — entities with identical component sets share dense chunks; ~2× iteration throughput at high entity counts, but structural changes force chunk moves), **sparse-set** (EnTT — cheaper add/remove, worse iteration locality), and **bitset+SoA** (bitECS — component data in arrays indexed by entity ID, membership in bitmasks). Benchmarks consistently show archetype wins on iteration, sparse-set wins on churn. For Shapeland, **bitECS's model is the right default**: it is not archetype-based, it uses bitmasks over contiguous arrays, and its query results are cached and updated incrementally.

**bitECS 0.4 specifics** (full TS rewrite): storage-agnostic — you pick the backing store. Use SoA with `TypedArray` for anything hot:

```ts
const Position = { x: new Float64Array(MAX), y: new Float64Array(MAX) }
for (const eid of query(world, [Position, Velocity])) {
  Position.x[eid] += Velocity.x[eid]
}
// hot loops: index iteration beats for-of at high counts
const ents = query(world, [Position, Velocity], asBuffer)
for (let i = 0; i < ents.length; i++) { /* ... */ }
```

0.4 adds relationships (`IsA`, exclusive targeting, auto-removal), observers (`onAdd`/`onRemove`/`onSet`/`onGet`), prefabs, and `And`/`Or`/`Not` query operators. Its **ZAII** principle (Zero As Initial Initialization) is a determinism asset: design so zero is a valid default and `TypedArray` zero-init gives you free, identical starting state.

**TypeScript-specific rules for the sim package:**
- `Float64Array` over `Float32Array` for sim state — f64 arithmetic is IEEE-754 deterministic across V8/JSC/SpiderMonkey for `+ - * /`; `Math.sin/cos/pow/exp` are **not** spec-pinned. Ship your own polynomial trig/sqrt in `sim` or use fixed-point (`Int32Array` Q16.16). This is the single largest determinism risk in a JS sim.
- Zero allocation in hot loops: no closures per entity, no `.map/.filter/.forEach` in systems, no object literals, no string keys. Preallocate scratch buffers at world creation.
- `SharedArrayBuffer`-backed TypedArrays let the same component stores be read by a worker-side renderer with zero copy.
- AoS is acceptable only for cold, nested, rarely-iterated data (dialogue trees, quest state).

**Determinism inside the ECS.** Never iterate a `Map`/`Set`/object whose insertion order varies. Entity IDs must be allocated from a deterministic free-list (LIFO recycling with a generation counter), never from `Date.now()` or a hash. Sort query results by entity ID when a system's output depends on order (spatial queries, collision pair resolution) — or better, make systems order-independent. Recycle IDs identically on replay. All RNG flows through one seeded PRNG (**PCG32** or **xoshiro128\*\***) stored *in* the world so it snapshots and rewinds with everything else; use a separate unseeded RNG for cosmetics only.

**Structural change costs.** Adding/removing components invalidates cached queries. The universal answer is **deferred mutation**: flecs and DOTS both queue world modifications in command buffers and flush at phase boundaries, which is simultaneously a performance and a determinism win.

## 2. Engine Architecture Patterns

**Loop.** Fixed timestep accumulator with a bounded catch-up count (spiral-of-death guard), render interpolating between the last two sim states:

```ts
acc += Math.min(realDt, MAX_FRAME_DT)
while (acc >= DT && steps++ < MAX_CATCHUP) { world.step(inputFor(tick++)); acc -= DT }
render(alpha = acc / DT)   // lerp prev→cur transforms
```

Render never mutates sim state. Never read wall-clock inside `sim`.

**Scheduling.** Explicit named phases (`PreTick → Input → AI → Movement → Collision → Effects → PostTick`) with a static, centrally declared system order. Systems are plain functions `(world) => world` so they can be reordered, profiled independently, and unit-tested. Reject any dynamic/priority-based ordering — it's a determinism hazard and a debugging nightmare.

**Command buffers.** All spawn/despawn/add/remove go into a per-phase buffer, sorted deterministically, flushed at phase end. Same for events: double-buffered event queues (write to buffer A this tick, systems read buffer B from last tick) give you a fixed, order-independent read model.

**Sim/render split.** Double-buffer the transform-relevant subset of state (`prev`, `cur`) and hand the renderer a read-only view. Where you use `SharedArrayBuffer`, use seqlock-style versioning rather than locks.

**One sim, three hosts.** The `sim` package must import zero platform APIs — no `performance`, `Date`, `crypto`, `fetch`, `document`. Inject them via a `platform` capability object. Then the identical module runs under Node (CI), in a worker (game), and in the editor. Enforce this mechanically (§9), not by convention.

## 3. Editor and Tooling Architecture

**Share the real code.** The editor imports `sim` and `render` as workspace dependencies and runs an actual world instance. A tool that reimplements game logic is a tool that lies. The editor's "play" button steps the real sim loop over the real content.

**IMGUI vs retained.** Dear ImGui's core argument — no duplicated state, no widget tree sync, no data binding — is exactly right for **debug overlays, inspectors, and gizmo tooling**. For a browser editor, use an IMGUI-shaped discipline (game state is the single source of truth; UI derives from it every frame) even if the substrate is React. Practical split: React/DOM for panels, chrome, forms; canvas-drawn immediate-mode for the viewport overlay, gizmos, and per-frame debug. **Tweakpane** or **leva** for parameter panels — near-zero cost, and Tweakpane is what most Three.js tooling standardizes on.

**Undo/redo.** Use the **command pattern** with a serializable, replayable edit log — not immutable snapshots (memory blowup on large levels) and not raw event sourcing (rebuild cost). Every edit is `{ op, target, before, after }`, which gives you undo, redo, a diffable content history, multi-user merge later, and — critically — **agent-authorable edits**: an AI agent emits the same command objects a human UI would, so the tool and the agent share one mutation path.

**Picking and gizmos.** GPU picking (render entity IDs to an R32Uint attachment, read back one pixel) beats raycasting for dense scenes and is exact for instanced/skinned geometry. In WebGPU use a second render pass with an ID target; `three-mesh-bvh` is the CPU fallback for ray queries. Gizmos should be a `render` package feature so both editor and in-game debug get them.

**Hot reload.** Content hot reload via Vite's HMR API is straightforward and worth doing on day one:

```ts
if (import.meta.hot) {
  import.meta.hot.accept('./levels/manifest.json', (mod) => {
    world.reloadContent(mod.default)   // rebuild entities, preserve player state
  })
  import.meta.hot.on('shapeland:bake-done', (p) => assets.invalidate(p.hashes))
}
```

Code hot reload of *systems* is realistic (systems are pure functions — swap the function reference in the schedule); hot reload of *state layout* is not — reload the world instead. Add a dev-only Vite plugin exposing `POST /__shapeland/write` so the editor writes back to on-disk content files and HMR closes the loop. Live link: editor and game connect over the Vite dev-server WebSocket; editor sends edit commands, game echoes back state hashes and profiling data.

## 4. Content Pipelines

**Schema-first.** **Zod v4** for authoring DX (14× faster string parsing than v3, 57% smaller, `z.toJSONSchema()` built in). **TypeBox** where the schema *is* JSON Schema and you want Ajv JIT-compiled validation — measurably fastest, and directly consumable by editors, LLM tool-calling, and content-authoring agents. Pragmatic split: **Zod as source of truth in `content`, emit JSON Schema at build time, compile with Ajv for the bake step and editor validation.** Validate at build time and fail the bake; runtime validation only at dev-time behind a flag.

**Deterministic baking.** Bakes must be byte-identical for identical inputs:
- Set `SOURCE_DATE_EPOCH` (to the git commit timestamp) and `TZ=UTC` on all runners.
- Pin every tool version by digest — `gltf-transform`, `gltfpack`, `basisu`/`toktx`, `wasm-opt`. A `basisu` version bump changes output bytes.
- Sort all directory traversals and map iterations; never embed absolute paths or hostnames.
- Verify by baking twice in CI and diffing hashes.

**Content-addressed assets.** Cache key = hash of (input file bytes + normalized tool arguments + tool version + baker source hash). Store outputs as `<sha256>.ktx2` with a manifest mapping logical ID → hash. This gives free incremental bakes, free CDN immutability, and a cheap "did this asset actually change?" check in PRs.

**Concrete tooling.** `gltf-transform optimize in.glb out.glb --compress meshopt --texture-compress uastc` runs prune+dedup+weld+compress in one pass (typically 5–10× smaller). Prefer **meshopt over Draco** — faster decode, better morph-target/animation support, and it composes with `KHR_mesh_quantization`. Never apply both to one file. **UASTC for normal/data maps, ETC1S for albedo/color** — UASTC everywhere roughly triples texture size for no visible gain. `gltfpack` is the alternative when you want C++-speed batch processing and `EXT_mesh_gpu_instancing`. Always run `gltf-transform validate` before compressing; compression amplifies malformed input. Run `wasm-opt -O3` on every WASM artifact (20–40% size, 5–15% speed).

## 5. Replay, Debugging, Observability

**The artifact.** A Shapeland bug repro is `{ seed, contentHash, buildHash, inputLog }` — a few KB, checked into the repo next to a Vitest case. This should be the *only* accepted bug report format from agents. Record inputs as `(tick, deviceId, buttonMask, axes)` tuples; zstd-compressed this stays well under a KB per minute.

**Hashing.** Compute an **FNV-1a** or xxhash over a canonical state buffer every tick in CI, every N ticks in-game. Critically, emit a **layered breakdown** — per-component-type and per-system sub-hashes — not just a total. When a divergence appears, the layered hash tells you *which component type* drifted, collapsing debugging from hours to minutes. This is exactly the Klotho/Scharnhorst pattern.

**Bisection.** Two axes. (a) *Temporal*: binary-search the tick where two runs' hashes first differ. (b) *Causal*: git-bisect over commits replaying the same input log. Both are scriptable and both should be first-class CLI commands: `shapeland replay diff a.rec b.rec` printing the first divergent tick, subsystem, entity, and field.

**Time travel.** Because the sim is deterministic, you don't need dense snapshots — snapshot every N ticks (ring buffer sized to `maxRewind`) and re-simulate forward to any tick. The replay viewer needs three things minimum: seek, variable speed (0.25×–8×), single-frame step — plus an input-state overlay showing exactly what was pressed.

**Overlays and telemetry.** In-game overlays: tick number, state hash, entity count, per-system ms (rolling p50/p99), allocation delta, draw calls. For balance, log spatial events (`{type, x, y, tick, seed}`) and bin them server-side; a 1m-cell `SELECT FLOOR(x), FLOOR(y), COUNT(*) GROUP BY 1,2` over a columnar store (ClickHouse/DuckDB locally) is all a heatmap needs. Note the practical warning from Transformers: WFC's balance maps — each bin needs *hundreds* of samples, so heatmaps are a live-ops tool, not a dev-time tool, unless you generate the plays with bots. **For an all-agent team, that's the unlock: run 10,000 headless bot sessions overnight and heatmap those.**

## 6. Testing Infrastructure at Scale

**Property-based (fast-check).** The highest-value tool here is `fc.commands` + `fc.modelRun` — model-based testing where commands are player actions (`Move`, `Interact`, `PickUp`) with `check(model)` preconditions and `run(model, real)` assertions. Its shrinker is command-aware: given `[A,B,C,A,A,C]` where only `[A,-,C,A,-,-]` executed, it shrinks `[A,C,A]`. Always persist `{ seed, path, replayPath }` from failures into a regression test — `replayPath` is required for `commands` replay and is easy to forget.

Highest-value properties: sim determinism (same seed+inputs ⇒ same hash), snapshot round-trip (`restore(save(w))` hashes equal), rewind-resimulate equality, no entity leaks, invariants (health ≥ 0, no NaN in any component array).

**Golden images.** The dominant finding across 2026 sources: **environment parity beats threshold tuning**. Generate baselines inside the exact pinned Playwright Docker image CI uses (`v1.xx-jammy`, never `latest`); a Playwright version bump shifts font rendering and invalidates baselines. Set `maxDiffPixels` to ≤0.01% of frame area (~200px at 1080p) — if you keep raising it, you have an environment problem, not a tolerance problem. For WebGPU headless you need explicit flags (`--enable-unsafe-webgpu`, `--use-angle=vulkan`) or you silently fall back to a software path that renders *correctly but differently*. Isolate visual tests in their own CI stage and upload diff artifacts.

**Performance budgets.** `vitest bench` for sim-step microbenchmarks against a committed `baseline.json`. CI runners are noisy — use a generous tolerance (15–25%) or **CodSpeed** (instrumented, machine-independent counts) rather than wall-clock. Separately, assert *shape* not speed: tick time must be O(n) in entity count (run at 1k/10k/50k and check the ratio), which catches accidental O(n²) regardless of runner noise.

**Allocation steadiness.** Under `node --expose-gc`, run 10k ticks, force GC, sample `process.memoryUsage().heapUsed` at intervals, assert the slope is ~flat and that steady-state per-tick allocation is under a hard byte budget. This is the test that keeps the hot loops GC-free.

**Soak + mutation.** Nightly: 1M-tick headless soaks with periodic hash checks and invariant assertions. **Stryker** with `coverageAnalysis: "perTest"` (the vitest-runner forces this anyway), `--since main` on PRs, full sweep weekly, `thresholds.break` set to current-minus-buffer and ratcheted. Mutate `sim` and `content` validators only — mutation-testing render code is wasted compute.

## 7. WASM for Tooling

**When it pays.** Rule of thumb from the benchmarks: WASM wins at **1.5–3× (4–6× with SIMD)** when compute-per-boundary-crossing is high and the module is loaded once and reused. It *loses* to JIT'd JS when crossings are frequent and per-crossing work is trivial. Your BFS reachability provers are the canonical good case — one call in, a proof out.

**The boundary is the whole game.** `wasm-bindgen`'s auto-marshaling *copies* slices; in one published benchmark, JS 1.40ms → wasm-bindgen 1.62ms (slower!) → raw WASM 0.353ms → raw WASM+SIMD 0.231ms. Design accordingly: allocate the level buffer *inside* WASM linear memory, hand JS a `Uint8Array` view over it, write into it, then call `solve(ptr, len)`. Zero copy.

```ts
const ptr = wasm.alloc(bytes.length)
new Uint8Array(wasm.memory.buffer, ptr, bytes.length).set(bytes)
const verdict = wasm.prove_reachable(ptr, bytes.length)  // one crossing
```

**Workflow.** `wasm-pack build --target web --release` → `wasm-opt -O3` → publish as a workspace package with generated `.d.ts`. Enable SIMD via `RUSTFLAGS="-C target-feature=+simd128"`; feature-detect and ship a scalar fallback. Gotcha: **linear memory grows but never shrinks** — for large one-off proofs, instantiate a fresh module and discard it. Build once, consume the same artifact in `tools` (CI prover), the editor (author-facing "is this level solvable?" button), and Node tests — this is a strong argument for the prover being the *only* implementation, with no TS reimplementation to drift from it.

## 8. Solver/Prover Tooling for Level Validation

**Representation first.** Bitplanes — one packed 1-bit-per-cell plane per entity type (walls, keys, doors, movable blocks). A 10×8 grid is 10 bytes vs 800 for a byte array. The packed bytes *are* the canonical form, so hashing is free, the wire/URL format is free, and set operations (reachability flood-fill, collision) become word-parallel bit ops. Keep human-readable level text as an interchange format only; convert at the edge.

**Canonicalization is the biggest win.** In Sokoban solvers, player position doesn't define state — the player's *reachable region* does. Normalizing the player to the topmost-leftmost reachable cell collapses huge equivalence classes. Find Shapeland's analog (symmetry, irrelevant ordering, position-within-region) before optimizing the search itself; it typically beats every micro-optimization combined.

**Search.** BFS for shortest-solution proofs; A\* with an admissible heuristic when you need speed over optimality; **meet-in-the-middle** (forward from start, backward from goal, meet at hash-set intersection) roughly square-roots the frontier for reversible mechanics. Prune aggressively — dead-end/stranding detection via connected-component labeling, forced-move fast-forwarding (chains of single-option moves taken at zero queue cost), chokepoint detection. Matt Zucker's flow-solver and its WASM port are the reference implementation of this pruning stack.

**SAT/SMT.** **Z3 compiled to WASM** runs industrial-strength constraint solving in-browser with no backend (proven by the flow-free-solver project). Use it for *uniqueness* proofs (assert the found solution is excluded, re-solve; UNSAT ⇒ unique) and for combinatorial constraints where you'd otherwise hand-write a search. Use BFS for reachability/shortest-path. Rule: BFS answers "can you get there and how fast"; SMT answers "is there exactly one way" and "is this configuration consistent."

**Keeping proofs CI-fast.** Content-address the proof: key = hash(level bytes + rules version + prover version). Skip unchanged levels entirely. Per-level timeout with the timeout itself as a failure. Two tiers: cheap invariants (reachability, no orphan regions) on every commit; expensive uniqueness/optimality proofs nightly or on `content/**` changes only. Emit proof certificates (the winning move sequence) as build artifacts — they double as regression tests and as gold-path replays for the golden-image suite.

## 9. Monorepo and DX

**Boundaries — use two layers, not one.** Turborepo 2.4+ `boundaries` (add `"boundaries": true` to root `turbo.json`) catches package-level violations: importing a package not in `package.json#dependencies`, and reaching outside a package directory via `../../..`. It's experimental and package-granular only. Layer **dependency-cruiser** on top for the rules that actually protect Shapeland:

```js
{ name: 'sim-is-pure', severity: 'error',
  from: { path: '^packages/sim' },
  to: { path: 'node_modules|^packages/(render|ui|platform)' } }
```

That single rule is what keeps the sim runnable identically in Node, worker, and CI. Add a "no `Date`/`Math.random`/`performance` in sim" rule too — dependency-cruiser can match module *and* it's cheap to add a custom ESLint rule for the globals. `eslint-plugin-boundaries` covers intra-package layering if you need it.

**Build.** **Turborepo** for task orchestration + remote caching. Turborepo's own docs explicitly recommend **against** TS project references — they add a second config surface and a second caching layer that fights Turbo's. Give each package its own `tsconfig.json` (better cache granularity), no root one. **Biome** for lint+format (single fast binary, one config, no plugin zoo) with ESLint retained only for the boundary plugins if you need file-level rules.

**Release + CI.** **changesets** with conventional commits. Structure CI as fast-fail tiers: (1) Biome + typecheck + dependency-cruiser — under 60s; (2) unit + property tests, sim determinism, cheap proofs; (3) bake + golden images + WASM build in the pinned container; (4) nightly soak, full mutation run, expensive proofs, bot telemetry generation. Only tiers 1–2 gate every push.

## 10. Lessons on Tool-Building Priorities

**"Tools live longer than games do."** — John Romero, quoted in Christos Reid's survey of tools built by Romero (TED), Tim Sweeney (UnrealEd), Chris Norden (Deus Ex), and Mark LeBlanc. The striking finding: most of those tools are still in use decades later, and none of their authors expected that. Design the toolchain's data formats as if they outlive Shapeland, because they will.

**Watch the workflow before building the tool.** InnoGames' most valuable automation on Sunrise Village came from observing that a designer was hand-typing definitions into Confluence → Excel → CSV → Unity. One hour of tool-building removed days of recurring work per content update. The lesson generalizes hard for an all-agent team: **the bottleneck is almost always an unglamorous data-shuffling step nobody bothered to fix.** Instrument your own agents' loops — count how many turns go to re-running a bake, re-finding a repro, or re-typing a level — and build against those counts.

**Tools as a system, not a pile of features.** Laura Teeples (343 Industries) argues that per-tool compromises compound across a 40-hour week into an unusable whole; evaluate the *set*. For Shapeland this means one CLI (`shapeland bake|prove|replay|bench|diff`), one content format, one command-log mutation path shared by editor and agents.

**Sustained investment beats heroics.** Isadora Rodopoulos's GDC talk on small-team tooling makes the case that a data-oriented core is what *makes* tooling cheap: when gameplay is data, the editor is a data editor and stays generic. Counterweight from Deconstructor of Fun: maintenance runs 60–80% of a system's lifetime cost, and opportunity cost is the line item nobody writes down. Build tools that share the game's real code (so they cost near-zero to maintain) and buy/adopt everything on the periphery.

**Priority order for Shapeland, defensible from the above:**
1. Deterministic sim + state hashing + input-log replay — *everything else in this document is downstream of this*.
2. `shapeland replay diff` with layered per-subsystem hashes (turns desyncs from days into minutes).
3. Content-addressed, reproducible bake with schema validation at build time.
4. Headless bot harness (generates the volume that makes heatmaps, soaks, and property tests meaningful).
5. Level editor sharing real sim code, with the WASM prover wired to a "validate" button.
6. Golden-image suite in a pinned container — last, because it's the most flake-prone and lowest information-per-CI-minute.

---

## Sources

- bitECS 0.4 docs — Introduction / Component / Query: https://bitecs.dev/docs/introduction · https://bitecs.dev/docs/component · https://bitecs.dev/docs/query
- Archetype ECS in TypeScript (bitECS vs miniplex trade-offs): https://grzegorzotto.dev/blog/archetype-ecs-typescript
- "The Essence of Entity Component System" (archetype vs sparse-set benchmarks, DOTS/Bevy/flecs survey): https://arxiv.org/html/2606.14919
- coherence — Determinism, Prediction, Rollback: https://docs.coherence.io/manual/advanced-topics/competitive-games/determinism-prediction-rollback
- Klotho SynchronizationDesign / DesyncDiagnostics (layered hashing, input-vs-state classification): https://github.com/xpTURN/Klotho/blob/main/Docs/SynchronizationDesign.md · https://github.com/xpTURN/Klotho/blob/main/Docs/DesyncDiagnostics.md
- O3DE diorama — 2D deterministic sim design (FNV-1a state hash as CI assertion): https://github.com/nickschuetz/o3de-diorama/blob/main/Docs/design/2d-deterministic-sim.md
- Bugnet — Debugging desync in deterministic lockstep / session replay systems: https://bugnet.io/blog/how-to-debug-desync-in-deterministic-lockstep-games · https://bugnet.io/blog/how-to-build-a-session-replay-system-for-game-debugging
- Scharnhorst (determinism as first-class architecture, journal/commit hashing): https://github.com/ytfh44/scharnhorst
- glTF-Transform CLI + gltfpack: https://gltf-transform.dev · https://meshoptimizer.org/gltf/ · https://github.com/zeux/meshoptimizer/blob/master/gltf/README.md
- Deterministic build outputs & `SOURCE_DATE_EPOCH`: https://www.static-asset-fingerprinting.com/static-asset-fingerprinting-fundamentals/deterministic-build-outputs/why-deterministic-builds-matter-for-asset-fingerprinting/
- BuildStream cache-key architecture (content-addressed artifacts): https://docs.buildstream.build/master/arch_cachekeys.html · https://docs.buildstream.build/master/arch_caches.html
- Zod v4 / TypeBox / Valibot / ArkType comparison: https://www.pkgpulse.com/guides/zod-v4-vs-arktype-vs-typebox-vs-valibot-2026 · https://jsonwebtools.com/json-validators-comparison
- fast-check — Model-based testing & `commands` shrinker: https://fast-check.dev/docs/advanced/model-based-testing/ · https://fast-check.dev/docs/api/functions/commands/
- Playwright visual regression 2026 (Docker parity, thresholds, headless GPU): https://qaskills.sh/blog/playwright-visual-regression-testing-guide · https://scrolltest.com/visual-regression-testing-playwright-docker-ci-cd-2026/ · https://assrt.ai/alternative/playwright-headless-vs-headed-rendering
- StrykerJS mutation testing + Vitest runner: https://stryker-mutator.io/docs/stryker-js/vitest-runner/ · https://qaskills.sh/blog/mutation-testing-stryker-guide-2026
- WASM performance & the JS boundary: https://rs4ts.dev/19-wasm/09-performance/ · https://techtalknews.com/posts/webassembly-production-guide · https://dev.to/bence_rcz_fe471c168707c1/rust-webassembly-performance-javascript-vs-wasm-bindgen-vs-raw-wasm-with-simd-4pco
- Bitplanes in a Sokoban solver (canonicalization, packed state): https://alexishope.dev/posts/bitplanes-sokoban-level-solver/
- Flow Free solver — Z3-in-WASM + heuristic BFS pruning: https://github.com/kongesque/flow-free-solver · https://mzucker.github.io/2016/08/28/flow-solver.html
- Turborepo Boundaries RFC + TypeScript guide: https://github.com/vercel/turborepo/discussions/9435 · https://turborepo.dev/docs/guides/tools/typescript
- dependency-cruiser / eslint-plugin-boundaries: https://github.com/sverweij/dependency-cruiser · https://github.com/javierbrea/eslint-plugin-boundaries
- Dear ImGui — the IMGUI paradigm: https://github.com/ocornut/imgui/wiki/About-the-IMGUI-paradigm
- Vite HMR API: https://vite.dev/guide/api-hmr
- Christos Reid, "What I Learned About Tools Development From Games Industry Legends" (Romero: "tools live longer than games"): https://www.youtube.com/watch?v=Zp4tJQJKIPs
- GDC — Isadora Rodopoulos, "Making Delightful Tools for Sustainable Small-Team Development": https://www.gdcvault.com/play/1035501/Making-Delightful-Tools-for-Sustainable
- GDC — Laura Teeples (343 Industries), "The System of Tools: Reducing Frustration in a Daily Workflow": https://www.gdcvault.com/play/1025806/Tools-Tutorial-Day-The-System
- Deconstructor of Fun — "The Hidden Cost of Studio Engineering" & InnoGames AI adoption: https://www.deconstructoroffun.com/blog/the-hidden-cost-of-studio-engineering · https://www.deconstructoroffun.com/blog/the-most-honest-ai-adoption-story-in-gaming
- AWS — Event-based analytics pipeline for Amazon Game Studios' Breakaway (spatial binning, heatmaps): https://aws.amazon.com/blogs/big-data/building-an-event-based-analytics-pipeline-for-amazon-game-studios-breakaway/
- GameAnalytics — Balance and Flow Maps (sample-count limits of heatmaps): https://www.gameanalytics.com/blog/balance-and-flow-maps
- Embark Studios telemetry pipeline (Arc Raiders, 100B events/day, in-engine round viewer + voxel heatmaps): https://eidok.com/blogs/17400/How-Arc-Raiders-Tracks-Every-Bullet-in-Real-Time
