# Shapeland — Design Document

**Shapeland is an open world adventure RPG in the browser.** The player is a rolling cube with
equippable elemental faces, exploring a white grid world through an Elden Ring lens: adventure,
discovery, enemies whose shapes ARE their behavior, and color returning to the world where the
player has been.

This document is the vision and the contract. The proven vertical slice specification is
[vertical-slice-plan.md](vertical-slice-plan.md), and its working implementation is
`prototype/vertical-slice.html` — a single-file build that verified every system here. Domain
research lives in [kb/](kb/README.md).

---

## 1. Pillars

**Pillar 1 — Movement and ability selection are the same verb.** Rolling to a cell also decides
what is armed when you arrive (the up face). Nothing else selects abilities. Every system must
deepen this fusion, never bypass it.

**Pillar 2 — Geometry is grammar.** A shape's form predicts its behavior with zero tutorialization.
The player is a d6: four directions, one face at a time. Enemies and NPCs are other polyhedra whose
movement grammars differ.

**Pillar 3 — The world is white; color is memory.** Shapeland starts colorless. Fire, lightning,
scorch marks, ion scars, and the color-flood behind opened seals are the record of the player's
passage. **Color is always earned, never decorative.**

**Pillar 4 — Teach through the body.** Rules are learned physically — a refused roll bumps, a glyph
seals to your underside — before they are ever named in text. Hints and dialogue confirm what the
body already suspects.

### Razors

Use these to settle a decision without escalating:

- Does it make the up-face matter more, or less? Less is a no.
- Could a player predict this behavior from the shape alone? If not, redesign the shape.
- Is this color earned? If not, remove it.
- Does this teach with the body, or with text? Text is the fallback, never the plan.
- Can it be proven? If it can be, it must be.

---

## 2. From vertical slice to open world

The slice proved the verbs. The open world scales them. What changes:

| Dimension | Vertical slice | Shapeland |
|---|---|---|
| Space | one authored corridor, ~25 cells deep | districts of 950–1,900 cells crossing, streamed |
| Structure | linear with one detour | hub-and-loop topology with earned shortcuts |
| Abilities | Fire, Lightning, Physical, Normal | plus Ice, Swap, Imprint, then Void/Gravity/Rot/Shatter |
| Enemies | one archetype (cone sentry) | bestiary by grammar: octahedron, cylinder, tetrahedron, sphere, d12/d20 bosses |
| Death | anchor respawn, 3 integrity | corpse run: abilities burn into death tiles, return blank to reclaim |
| Progression | found-gated equip | found-gated equip + color-return meta as exploration record |
| Navigation | region titles | region titles, landmark bands, no minimap and no quest log |

**What does not change:** the quarter-turn invariant, the sim/render split, socket proofs, the
camera policies, and determinism. An agent that breaks one of those is regressing the game no
matter what it adds.

### The open-world specific problems

1. **Sightline calibration overrides density.** A grid world of hard-edged cubes with no foliage has
   very long sightlines and few natural blockers. *Oblivion*-density in *Fallout 3*'s sightlines
   felt cramped and cost Bethesda two months of alpha to fix. **Measure this before locking world
   size.** See [open-world-pacing.md](kb/open-world-pacing.md) §6.
2. **Budget world size from build cost, not ambition.** Fully populate one ~400×400-cell chunk to
   target density, measure how long it took, then multiply by available schedule. That number is
   the world size.
3. **Traversal must stay interesting at scale.** The slice's 0.19s roll is fun for 25 cells; it must
   survive 950. Kojima's answer is terrain-as-antagonist — slope, footing, and momentum costs — not
   faster movement.
4. **Legacy dungeons have no map; the open field does.** FromSoftware's asymmetry is deliberate and
   should be copied exactly.

---

## 3. Architecture contract

A pnpm monorepo, TypeScript strict everywhere, with hard package boundaries:

- **`@shapeland/sim`** — the deterministic core: grid, orientation math, movement, combat, terrain,
  quest state. **Pure TypeScript, zero DOM, zero Three.js.** Runs identically in Node, in a worker,
  and in CI. `noUncheckedIndexedAccess` on.
- **`@shapeland/render`** — WebGPU/WebGL presentation of sim state. Reads sim snapshots; never
  mutates them.
- **`@shapeland/content`** — world data, terrain authoring, ability definitions, dialogue, regions.
  Data plus schemas, validated at build time.
- **`@shapeland/ui`** — HUD, equip screen, dialogue, menus. The game UI is a game shell, not a web
  app.
- **`@shapeland/platform`** — input, save, audio, PWA glue, telemetry. All environment probing lives
  here behind capability objects.
- **`@shapeland/tools`** — asset bakers, proof runners, replay inspector, balance simulators. See
  [TOOLS-PLAN.md](TOOLS-PLAN.md).

**Non-negotiables:**

- **Sim/render split is absolute.** Sim runs a fixed 120Hz accumulator with seeded RNG; a run is
  `(seed, inputLog)`. Render interpolates between ticks.
- **Orientation is an integer `0..23`, never an accumulated quaternion in sim.** Roll and pivot are
  table lookups, generated and proven once at boot. Quaternions live only in render.
- **Collision data ≠ render data.** Occupancy is an ECS component query; meshes are a render-side
  mapping. The two cannot be conflated again.
- **Zero allocation in per-tick and per-frame hot paths.** A CI test runs 10k ticks and asserts a
  steady heap.
- **Crossing a package boundary requires updating the contract test in the same PR.**
- **Every excluded or deferred decision becomes an ADR**, so choices are revisited deliberately and
  never relitigated blind.

---

## 4. Canonical constants

These live in `@shapeland/sim/constants.ts`, imported by content, render, and tests alike — never
restated locally.

**Movement** — `ROLL_DUR .19` · ease `t²(2.2−1.2t)` · `JUMP_V0 7.6` · `GRAV 25` · hang `2.3 @ .62`
· `FLIGHT_DUR ≈ .72` · `LEAP_CELLS 2` · `JUMP_BUFFER .20` · `TUCK_DUR .34` · squash `300/21`.

**Camera** — offset `(0, 9.2, 17.77)` · FOV 42 · aim `.55` · follow `5.2/s` · climb `4.5/s` ·
lookahead `.85 @ 4/s` · fog `42/110` · shadow `±22/70`, radius 1.8, bias `−.0012`.

**Combat** — `AOE_R 1.55` · kill pad `+0.8` · turret aim `1.5` / cool `1.6` / range `6.5` · spin
`.5 → +12·k^1.6` · `TELE 0xb8412a` · i-frames `1.0` · integrity `3`.

**Terrain** — sky exposure `1.0 / .78 / ×.86 / −.055` · `peak ≤ 8`, noise filler `≤ 5` (ADR 0015) ·
`CAM_CLIMB 4.5`.

**Toon** — bands `[.62, .84, 1.0]`. **Shake** — floor `.004`, impacts `.05–.20`. **Input** — pad
dead zone `.38`, touch `.36`, `STICK_R 40`.

**Palette** — cube body `#4a7fd4` · fire `#ff5a1f` · lightning `#3b46e0` · physical `#3a3a44` ·
normal `#c2beb8` · glyph halo `rgba(238,244,252,.95)` · grid major
`rgba(132,148,196,.78)` every 4 cells, minor `rgba(146,161,205,.48)`.

**Pacing** (derived, see [open-world-pacing.md](kb/open-world-pacing.md)) — micro beat 16 cells ·
life beat 50–105 · POI ceiling **211** · named beat ~950 · checkpoint spacing 200–230 · landmark
bands 60–200 / 300–800 / ≥1500 cells · occlusion 50–70%.

---

## 5. Design ledger

### Included, with the deciding reason

Cube-only player d6 (pillar 2 purity) · Fire + Lightning + Physical + Normal · down-face sockets
(fuses equip with rolling-cube puzzles) · PIVOT (**provable necessity** — see below) · blank start
with found-gated equip (equipping IS onboarding) · pyramid sentries (simplest readable enemy
grammar: static, telegraphed, element-gated) · one NPC archetype · named regions · terraced
elevation · anchor respawn with integrity pips · pad + touch + keyboard parity.

**Why PIVOT is mandatory, not optional.** A roll is an odd permutation of the cube's four body
diagonals, so orientation parity is fixed by the cell's checkerboard color. Only **12 of 24**
orientations are reachable at any cell; all 6 up-faces are available but only 2 of the 4 spins each.
In a corridor with no loop, each cell admits exactly **one** down face — so a corridor socket would
be unopenable. An in-place 90° yaw is an odd element and restores all 24. A rolling-only cube on a
square grid can never fix this, because every closed walk on a square lattice has even length. This
is proven in `tools/verify-cube-group.mjs` and must stay proven.

### Deliberately excluded, and why

- **Free camera / rotation** — a fixed camera keeps stick mapping absolute and bakes six cheap
  orientation-dependent systems. Rotation would force a basis recompute every frame and re-tuned
  readability.
- **A physics engine** — the grid IS the physics; determinism is what makes the proofs possible.
- **Smooth terrain and ramps** — violates terrain rule 1; sub-cell height would break the
  quarter-turn invariant.
- **Analog non-axis-locked movement** — the cube cannot move diagonally, so the input shape must
  tell that truth.
- **Outlines on the cube** — built, then cut: the saturated body plus halos read better. The
  technique stays in the archive, not the game.
- **Text tutorials** — pillar 4. The opening hint was removed on purpose.
- **Minimap / quest log** — discovery is the content; regions and landmarks navigate.

### Deferred, designed but not built — build in this order

1. **Ice** — AOE freezes a slick patch; rolling on it slides to the next dry cell, trading distance
   for face control. First, because it is the only ability that changes MOVEMENT. Place opposite
   Fire to weaponize the axis-exclusion rule.
2. **Swap** — exchange up and down faces; the only instant route to the down face. Pairs with
   sockets.
3. **Imprint** — stamp the last-used ability onto a Normal face: build your own die over a run.
4. **Sentries drop a Physical glyph** — the first enemy-sourced ability.
5. **Death as corpse run** — abilities burn into the death tiles; return blank to reclaim them.
   Loadout loss is too cruel when equip is identity.
6. **Bestiary by grammar** — octahedron (rolls diagonally, moves you cannot), cylinder (charges
   straight lines), tetrahedron (maddening roll pattern), sphere (unconstrained, the terror),
   d12/d20 bosses. Every telegraph measured in roll-counts.
7. **Color-return meta** — persistent per-region color as exploration record; the flood behind the
   first door is its seed.
8. **Void / Gravity / Rot / Shatter** abilities; **Mirror** ghost-cube; further regions behind
   face-stamp seals of the new elements.

**Geometry constraint on the bestiary.** Only the cube rolls face-to-face on a square grid. The
tetrahedron, octahedron and icosahedron need a triangular substrate, and the dodecahedron cannot
roll on any regular tiling. Each non-cube enemy therefore needs an explicit movement decision —
see [geometry.md](kb/geometry.md) §3, which gives three concrete options per shape. The
tetrahedron's one-pose-per-cell degeneracy is itself the basis for its "maddening" character.

---

## 6. Build order

Each phase ships a working build and its suite. A phase gate is full regression green plus that
phase's proofs.

0. **Scaffolding** — monorepo, boundaries, CI, fixed-timestep sim with seeded RNG and replay,
   snapshot bridge, preview deploys. *Gate: an empty game that ticks deterministically, replays
   byte-identically, and deploys on every PR.*
1. **Foundation** — renderer (WebGPU + fallback), camera, grid floor, toon system in TSL, cube with
   baked face textures, HUD shell. *Gate: camera/toon/palette suites plus first golden images.*
2. **Movement** — roll, jump, leap, buffer, pivot, squash, refusals. *Gate: the
   leap-equals-two-rolls proof and the orientation-lock proof.*
3. **Equip** — net overlay, drag/drop, draft/commit, persistence. *Gate: equip suite.*
4. **VFX** — fire physics and render, lightning two acts, decals, lights. *Gate: fire and vfx suites
   plus a stability sweep.*
5. **World slice** — tiles, shrine, gauntlet, socket and door, regions, NPC, integrity/respawn.
   *Gate: reachability, gating, socket proof, turret fairness.*
6. **Terrain** — helpers, hills, readability shading, height-aware movement/effects/camera.
   *Gate: terrain suites; critical path numbers unchanged.*
7. **Input breadth** — gamepad, prompts, modal capture. *Gate: pad suite.*
8. **Feel pass** — shake policy, linear camera feed, ground tracking. *Gate: camera policy, bob,
   ripple.*
9. **Ice** — freeze patch, slide without extra quarter-turns. *Gate: ice grammar proofs; socket BFS
   pins unchanged.* Open world (streaming, districts, bestiary, corpse run, color-return) stays
   deferred — see ADR 0011.

---

## 7. Open questions

- **Cell-to-metre scale is unresolved.** The pacing research derived checkpoint spacing assuming
  1 cell ≈ 1m; the architecture research assumes 1u ≈ 2m for converting real building dimensions.
  **Time-based pacing bands are canonical and scale-independent**; metre conversions are advisory
  until this is decided. Resolve it before authoring the first district, and record it as an ADR.
- Should PIVOT be gated (found like an ability) so early corridors teach the lock before handing
  over the key?
- Should leap height-clearance scale with a future ability?
- Is 3 integrity right once enemies multiply?
- How does the color-return meta persist across saves without becoming a completion checklist —
  the thing pillar 3 exists to avoid?
- What is the asynchronous social layer? A bounded glyph vocabulary satisfies both Miyazaki's
  withheld narration and Kojima's ropes; free text satisfies neither.

---

## 8. Working agreements

- **Prove, don't spot-check.** BFS over cell×orientation for every socket; parity lock demonstrated
  per space class; property tests with rotating seeds.
- **Test properties, not incidents.** "Stretch is monotone in speed", not "some slow particle
  exists".
- **Every fix ships a guard encoding the failure** — regression tests must assert the *mechanism*
  that found it, not merely the fix.
- **Simulate the whole path before patching.** Deterministic replay of the exact reported defect is
  step one of every bug fix, and the replay joins the corpus.
- **A flaky test is either a real intermittent bug or the assertion of an incident.** Diagnose;
  never retry-to-green.
- **Verify against the installed library**, not against memory. API behavior checks live as tests.
- **Environment APIs can exist and still throw.** Probe by calling, log once, disable for the
  session.
