# TUMBLE — Full Build Plan for Agentic Development

A complete specification for building TUMBLE from empty file to full game, written to be
executed by autonomous agents. Every system, practice, and principle here was proven in
the vertical slice; the design ledger at the end records what was deliberately included,
excluded, and deferred, with reasons. An agent following this plan should never need to
rediscover a lesson this document already contains.

---

## 0. VISION AND PILLARS

TUMBLE is a 3D browser game: a rolling cube with equippable elemental faces explores a
white grid world — "the Blank" — through an Elden Ring lens: adventure, discovery,
enemies whose shapes ARE their behavior, and color returning to the world where the
player has been.

**Pillar 1 — Movement and ability selection are the same verb.** Rolling to a cell also
decides what is armed when you arrive (the up face). Nothing else selects abilities.
Every system must deepen this fusion, never bypass it.

**Pillar 2 — Geometry is grammar.** A shape's form predicts its behavior with zero
tutorialization. The player is a d6: four directions, one face at a time. Enemies and
NPCs are other polyhedra whose movement grammars differ (see bestiary, §12).

**Pillar 3 — The world is white; color is memory.** The Blank starts colorless. Fire,
lightning, scorch marks, ion scars, and the color-flood behind opened seals are the
record of the player's passage. Color is always earned, never decorative.

**Pillar 4 — Teach through the body.** Rules are learned physically (a refused roll
bumps; a glyph seals to your underside) before they are ever named in text. Hints and
the Keeper's dialogue confirm what the body already suspects.

---

## 1. AGENTIC PROCESS & PRODUCTION ENGINEERING REQUIREMENTS

TUMBLE is a production title targeting AA indie quality on the open web. The
prototype's single-file constraint is retired; what it bought — total
verifiability, a deterministic core, zero hidden state — is now bought with
production architecture instead. Everything below is the working contract for
every agent on the project.

### 1.1 Repository and architecture

- **pnpm monorepo**, TypeScript everywhere, packages with hard boundaries:
  - `@tumble/sim` — the deterministic game core: grid, orientation math, movement,
    combat, terrain, quest state. **Pure TypeScript, zero DOM, zero Three.js
    imports.** This package IS the old headless-QA property, made structural: it
    runs identically in Node, in a worker, and in CI.
  - `@tumble/render` — WebGPU/WebGL presentation of sim state. Render reads sim
    snapshots; it never mutates them.
  - `@tumble/content` — world data, terrain authoring (the §5 helpers), ability
    definitions, dialogue, regions. Data + schemas, validated at build time.
  - `@tumble/ui` — HUD, equip screen, dialogue, menus (framework-light: solid or
    lit; the game UI is not a web app, it is a game shell).
  - `@tumble/platform` — input (touch/keyboard/gamepad), save, audio, PWA glue,
    telemetry. All environment probing (the gamepad-permissions lesson) lives here
    behind capability objects.
  - `@tumble/tools` — asset bakers, the proof runners, replay inspector, balance
    simulators.
- **Simulation/render split is absolute.** Sim runs on a fixed timestep
  (120Hz accumulator) with seeded RNG (`sfc32` or PCG; a run is `(seed, inputLog)`);
  render interpolates between sim ticks. Every defect report becomes a replayable
  artifact — "simulate the whole path before patching" is now a first-class tool,
  not a habit.
- **ECS in the sim** (bitECS-style data-oriented storage, or a small bespoke ECS):
  components for GridPosition, Orientation, Occupancy, Integrity, Telegraph, Burn.
  The prototype's hard-won separation of collision data from render data (§1.12
  lesson 6) becomes architecture: occupancy is a component query, meshes are a
  render-side mapping, and the two CANNOT be conflated again.

### 1.2 Language and code standards

- TypeScript `strict` everything; `noUncheckedIndexedAccess` on in `sim`.
- Biome for lint + format, enforced in CI; no warnings policy on `sim`.
- **Zero allocation in per-tick and per-frame hot paths** — pooled vectors,
  preallocated component arrays, scratch buffers; a CI allocation test runs the sim
  10k ticks and asserts steady heap.
- Public APIs between packages carry TSDoc and contract tests (§1.6).

### 1.3 Rendering stack (modern and experimental, deliberately)

- **WebGPU-first** via Three.js `WebGPURenderer` with automatic WebGL2 fallback.
  Materials authored in **TSL (Three Shading Language)** node graphs so one source
  compiles to WGSL and GLSL — the toon ramp, blackbody `fireRamp`, fbm erosion,
  sky-exposure terrain, and electric ribbons all port from §2/§6 as TSL functions
  in a shared `gfx` module (the GFX_LIB successor, single-sourced as ever).
- **GPU compute particles** where WebGPU is present: the fire plume's physics
  (buoyancy/entrainment/puffing) moves to a compute pass at 10–50k particles;
  the verified CPU implementation in `sim` remains the reference oracle — the
  compute path must match its statistical signatures in tests (§1.6).
- OffscreenCanvas + a render worker where supported, keeping the main thread for
  input and UI; COOP/COEP served so SharedArrayBuffer/Atomics are available for
  the sim↔render snapshot ring buffer.
- **WASM (Rust) for the provers:** the cell×orientation BFS solvers, reachability,
  and balance simulation compile to WASM with SIMD — run in CI as gates and shipped
  in `@tumble/tools` for content authors. The proofs stay mandatory; they just get
  fast enough to run on every content change.
- Post stack: tone-neutral (the world is white by design), with an accessibility-
  aware effects layer (§1.11). No feature lands render-side without its §2/§6
  readability rule restated as a test.

### 1.4 Determinism, replay, and simulation discipline

- All gameplay randomness flows from the run seed through named RNG streams
  (vfx randomness may be unseeded; anything affecting outcomes may not).
- **Input log replay** is a supported product feature (ghosts, bug reports, speedrun
  verification) and the primary debugging tool. CI replays a corpus of recorded
  runs after every sim change and diffs final state hashes.
- Fixed-point or integer state where equality matters (cells, orientations as one
  of 24 indices — never accumulated quaternions in sim; the render layer owns
  smooth quaternions). The quarter-turn invariant becomes a type: `Orientation`
  is `0..23` and roll/pivot are table lookups, generated once and proven once.

### 1.5 Testing pyramid (the QA spine, promoted)

- **Vitest** hosts every suite from §10, ported as packages' unit tests; the
  proof-style tests (socket solvability, orientation lock, leap≡two-rolls) run as
  CI gates via the WASM provers.
- **Property-based testing (fast-check)** replaces hand-rolled trial loops: "any
  mixed walk stays on-grid and face-flush", "erosion coverage is monotone in
  temperature", "no loadout makes a face unreachable" become properties with
  shrinking counterexamples.
- **Playwright end-to-end** drives the real game: input scripts roll the cube
  through the slice and assert sim state via a test bridge.
- **Visual regression closes the old gap.** The prototype's honest caveat —
  "logic-verified, visually unverified" — is retired: golden-image tests per
  scene (cube at rest, mid-roll, burning, bolt frame at fixed seed, terrain hill,
  each toon band) rendered headless (WebGPU in CI runners / SwiftShader fallback),
  diffed with perceptual thresholds. Shader changes now fail loudly when they
  change the picture.
- **Performance budgets in CI:** scripted 60s run must hold p95 frame ≤ 8ms sim +
  8ms render on the reference tier; bundle budgets per route; startup-to-
  interactive budget. Regressions block merge.
- Flake policy unchanged from the prototype: a flaky test is either a real
  intermittent bug or an assertion of an incident — diagnose, never retry-to-green.

### 1.6 Contracts between agents

- Package boundaries carry **contract tests**: `render` consumes a frozen
  `SimSnapshot` schema; `content` validates against JSON Schemas at build; `ui`
  talks to sim only through a command queue. An agent may refactor freely inside
  a package; crossing a boundary requires updating the contract test in the same
  PR.
- **ADRs (architecture decision records)** replace the prose design ledger for
  engineering choices: every "excluded/deferred" entry in §12 becomes an ADR with
  status, so decisions are revisited deliberately, never relitigated blind.

### 1.7 Delivery: CI/CD, observability, live operation

- Trunk-based development; small PRs; conventional commits; agent-reviewed then
  human-sampled. Every PR gets a **preview deploy** with its own replay corpus run.
- **Feature flags** gate all new systems; canary percentage rollout on the
  production channel; kill switches for anything network-touching.
- **Sentry** (errors + release health) with source maps; privacy-respecting
  telemetry (opt-in, aggregate: deaths per cell, socket attempts, ability usage —
  the balance instrumentation the prototype simulated offline now measures
  reality). A heatmap of real deaths feeds encounter tuning.
- Structured logging in dev builds; the in-game CAM/debug panel grows into a full
  debug overlay behind a flag.

### 1.8 Asset pipeline

- Build-time baking: the procedural face canvases, grid tiles, terrain side
  textures, and decals render once in `tools` and ship as **KTX2/Basis**
  supercompressed textures (procedural source stays canonical; the bake is
  reproducible). Meshes as glTF + meshopt. Audio: WebAudio graph with an
  AudioWorklet mixer; adaptive music layers keyed to region and combat state.
- Everything content-addressed and immutably cached; service worker precaches the
  critical path for **offline play** (PWA, installable).

### 1.9 Platform, saves, distribution

- Web is the primary platform (PWA). **Tauri wrappers** target Steam/itch when the
  content merits it — same codebase, platform package swaps saves/achievements.
- Saves: IndexedDB via a versioned, migrating schema (the prototype's found-gating
  validation generalizes into schema validation + anti-tamper of `found`); optional
  cloud sync later behind a flag. Never trust a save: validate on load, always.

### 1.10 Performance engineering

- Frame budget ledger maintained per system (sim tick, particle compute, shadow
  pass, UI) — additions must declare their budget line.
- Adaptive quality: particle caps, shadow map size, and compute-vs-CPU fire chosen
  by a startup probe + rolling frame-time governor.
- Pooling and reuse everywhere the prototype already learned to (lights, ribbons,
  telegraph planes, decals) — now enforced by the allocation test.

### 1.11 Accessibility, input, internationalization

- **Reduced-motion is a first-class mode** and it is nearly free: the camera shake
  policy (§8) already forbids traversal shake; the setting additionally zeroes
  impact shake and screen flash, and the game remains fully readable because
  telegraphs never relied on motion.
- Colorblind-safe telegraph shapes (the cross is already a shape, not just a
  color); high-contrast mode leverages the toon band system.
- Full input remapping (the PAD_BTN table becomes user-editable), hold/toggle
  options for PIVOT, and UI scale. All strings through an i18n catalog from day
  one; the Keeper's dialogue is authored in `content` with locale files.

### 1.12 The ten prototype lessons, carried forward (non-negotiable)

1. *Single-file verifiability* → the pure `sim` package + replay determinism.
2. *Headless QA before any claim* → CI gates; nothing merges red.
3. *Assertion-anchored patches* → git + small PRs + contract tests; an agent
   never edits across a boundary without the contract in the same change.
4. *Verify against the installed library* → pinned deps, renovate PRs run the
   full visual + proof suites; API behavior checks live as tests, not memory.
5. *Environment APIs can exist and still throw* → capability objects in
   `platform`, probe-by-calling, one info log, permanent per-session disable.
6. *Collision data ≠ render data* → ECS components vs render mapping, structurally
   separate.
7. *Simulate the whole path before patching* → deterministic replay of the exact
   reported defect is step one of every bug fix; the replay joins the corpus.
8. *Every fix ships a guard encoding the failure* → regression tests must assert
   the MECHANISM (the measurement that found it), not merely the fix.
9. *Full regression + stability sweeps* → CI matrix incl. property-test runs with
   rotating seeds; nightly long-run soak.
10. *Ship and present* → preview deploys on every PR; release notes generated
    from conventional commits.

## 2. RENDERING FOUNDATION

- **Renderer:** WebGPU-first (WebGL2 fallback) per §1.3; sRGB output, white clear
  color. All rules in this section are stack-independent readability law. Fog `0xffffff` near 42 / far
  110 — fog near MUST stay well beyond camera distance (17.4) or the subject itself
  hazes; the floor (320 units) must outrun fog far.
- **Toon shading, game-wide.** One 3-texel `DataTexture` ramp `[0.62, 0.84, 1.0]`,
  `NearestFilter`, through a single `makeToon()` factory replacing ALL
  `MeshStandardMaterial`. Band edges land at `dotNL = ±1/3`. Bands are high-key so
  white stays white. **Emissive bypasses the ramp by design** — emitters (burn glow,
  telegraphs) are not shaded like receivers. Hemisphere ambient stays continuous.
- **Flat facets on low-poly ink.** Indexed geometry (cones) → `toNonIndexed()` +
  `computeVertexNormals()`; polyhedra are already flat — converting them again warns.
  Smooth normals + toon = band edges swimming across spinning faces.
- **Shadow discipline.** One directional key light from screen-left
  (`cube + (−8.0, 10.5, 1.0)`), frustum `±22` (must exceed view height 13.4 and
  contain every on-screen caster; ±8 clipped distant shadows into hard rectangles),
  far 70, radius 1.8, bias −0.0012. **Receivers are floor surfaces ONLY** (ground
  plane, terrain tops). Slanted low-poly ink receiving shadows produces texel-grid
  acne.
- **Camera:** `CAM_OFFSET (0.0, 8.0, 15.45)` — yaw 0°, pitch 27.4°, dist 17.4,
  FOV 42, aim height 0.55. Yaw 0 makes cardinals unambiguous and pure diagonals an
  exact deterministic tie (`|x| >= |z|` picks X). Avoid yaws near ±45°/±135° (stick
  snapping becomes a coin flip). Zoom by scaling the offset uniformly, never by FOV.
  Camera orientation is baked into six places (VIEW_DIR, billboard bases, burst yaw,
  input basis) — any live change must call `recomputeCameraBasis()`.
- **Palette on white:** additive glow is invisible; brightness must come from
  saturation and dynamic point lights coloring the floor. Cube body `#4a7fd4`
  (contrast 1.99–3.03:1 vs floor across bands). Ability colors are single-sourced:
  fire `#ff5a1f`, lightning `#3b46e0`, physical `#3a3a44`; glyphs get light halos
  (`rgba(238,244,252,.95)` lw 13) because fire-on-blue alone is 1.01:1. Grid lines:
  periwinkle, major `rgba(132,148,196,.78)` every 4 cells, minor
  `rgba(146,161,205,.48)`.

---

## 3. MOVEMENT SYSTEM

The cube is grid-locked; position is always integer cells at rest, rest height
`H(cell) + 0.5`.

- **Roll:** `ROLL_DUR 0.19s`, ease `t²(2.2 − 1.2t)` (slow-in/fast-out). Orientation:
  ONE quarter-turn quaternion about axis `(dir.z, 0, −dir.x)` per cell — this
  invariant is load-bearing for the entire puzzle layer and must survive every
  feature. Position is parametric (not pivot-derived) so height steps work: xz by
  ease, y lerped between rest heights plus `(0.21 + 0.24·max(0,Δh))·sin(πe)` lift.
  On flat ground 0.21 matches the classical pivot arc. Landing snaps from roll START
  (`rStart + dir`, `rEndY`) so nothing drifts.
- **Jump / directional leap:** tap = vertical jump (`JUMP_V0 7.6`, `GRAV 25`, hang
  zone `|vy|<2.3` at 0.62 gravity). Hold a direction through the crouch (0.14s
  anticipation) = 2-cell leap: linear horizontal over precomputed `FLIGHT_DUR`
  (~0.72s, integrator-predicted, verified stable 30–144fps), 180° tumble completing
  at 88% of flight so the cube lands FLAT. A leap must equal two rolls exactly in
  position and orientation (QA: 400 trials at 1e-9 / 1e-6).
- **Jump buffer:** 0.20s (> ROLL_DUR so any mid-roll press fires on grounding).
  Buffered jump beats resuming a roll; landing resumes rolling if a direction is
  held — no dead frames.
- **PIVOT:** quarter-turn in place, `TUCK_DUR 0.34s` (1.8× a roll — costs tempo so
  routing still matters), modal (arm button, next direction turns in place, one turn
  per press). **This verb is mandatory, not optional:** rolling reaches only 12/24
  orientations per cell (odd-permutation parity), and in any space without a 2×2
  loop each cell admits exactly ONE down face — a corridor socket would be
  unopenable. Pivot restores all 6 down faces anywhere; a single isolated cell
  reaches all 24 orientations. The proof is permanent in QA and must remain.
- **Refusals teach:** rolls into walls, gaps, or |Δh|≥2 cliffs are refused with a
  squash kick and dust puff — the body learns the tile vocabulary first.
- **All movement feedback lives on the body** (squash spring: stiff 300, damp 21,
  shared scale target; dust). NEVER on the camera (§8).

---

## 4. ORIENTATION, EQUIP, AND THE FACE-STAMP LOCK

- Face order = BoxGeometry groups `+X,−X,+Y,−Y,+Z,−Z`; `FACE_OPPOSITE = [1,0,3,2,5,4]`
  (verified involution matching face normals). Up face by rotated-normal argmax; down
  face is its opposite. Face art from ONE shared canvas per ability (`FACE_CANVAS/
  FACE_TEX/FACE_URL`) consumed by cube materials, equip UI, pickups, and sockets —
  a single authoring point that cannot drift.
- **Equip overlay:** unfolded cross net (all six faces and their opposite pairings
  visible at once — the fact that matters for loadouts, since opposite faces can
  never come up in the same roll). Live UP/DOWN badges from current orientation.
  Pointer-based drag/drop (HTML5 DnD fails on touch) with 6px slop separating tap
  from drag; tap-select/tap-place fallback. Drafts commit on DONE (= save). Tray
  shows ONLY found abilities; saves validate found-gating (a save equipping an
  undiscovered ability is rejected; its legitimate finds still restore).
- **Face-stamp sockets** are the lock-and-key layer: a seal opens only when a
  required ability is pressed face-DOWN on the socket cell. Solvability is NEVER
  assumed: every socket ships with a BFS proof over (cell × orientation) states,
  asserting `solveMoves > arriveMoves` (the constraint costs something — a socket
  whose shortest arrival happens to satisfy it is hollow) and
  `solveMoves ≤ arriveMoves + 6` (maneuvering, not a maze). Layout changes re-run
  the proof; a sentry placed on the socket's own column once trivialized the puzzle
  by forcing a parity-fixing detour — enemy placement is part of puzzle balance.

---

## 5. TERRAIN — the construction reference (verbatim policy)

Terrain is BUILT from stacked unit cubes, LEGO-fashion. The five rules:

1. **Heights are integers** ≥ 0 (stacked cube counts). No half-steps or ramps, ever.
2. **A slope is a staircase:** ±1 steps roll (same quarter-turn — elevation never
   touches orientation math).
3. **A cliff (|Δh| ≥ 2) is a wall, both directions.** No unexitable pits.
4. **Leaps respect the arc:** clear a mid cell ≤ start+1, land ≤ start+1, drop any
   distance.
5. **Terrain keeps 2 cells of air** from gap rows (leap rims stay flat), structure,
   the door, sockets, pickups, NPCs, sentries, and the start.

Author ONLY via `terraceHill(cx,cz,peak)` (terraced pyramid, height = peak −
chebyshev ring, staircases on every side by construction; peak ≤ 3) and
`raiseRect` into the single `W.h` map. Every summit must be BFS-reachable.

**Elevation must be READABLE:** with the key light at 52°, a top and the sun-facing
side share a toon band — an all-white column has an invisible edge. Bake **sky
exposure** into the albedo: tops 1.00 (world stays white), vertical faces 0.78,
crevice falloff ×0.86 within each unit, −0.055 per unit below the summit, seam line
per course, corner and ground-contact occlusion, lip vignette on tops. Result:
1.27:1 lit-side edge, 1.97:1 shaded; adjacent courses countable at 7%.

Render one box per cell (grid tile top, seam-striped sides via texture repeat = h);
tops cast AND receive (they are floor).

---

## 6. VFX ARCHITECTURE

Shader + particles, physically grounded, on the shared blackbody ramp.

- **GFX_LIB** (shared GLSL): hash/value-noise/fbm and `fireRamp(T)` — continuous
  blackbody: smoke grey → ember `(0.55,0.13,0.020)` → red → orange → yellow →
  near-white. In the flame region (T > 0.18) luminance rises and blue/red rises
  monotonically with T (true blackbody ordering; the ember stop's blue was once too
  high and violated it). The smoke tail is off-curve grey and legitimately brighter
  than dark ember.
- **Fire** = verified plume physics (buoyancy 10, cooling τ 0.36, entrainment slope
  ~0.18, necking measured from EMISSION height, puffing at `1.5/√D` Hz with
  counter-rotating cohorts, cap 340) rendered as fbm-eroded discs: cooling both
  shrinks the body and raises the tear threshold —
  `d = r − (0.90 − 0.40(1−T)) + (0.52 − n)(0.60 + 0.85(1−T))` — coverage 54% → 30%
  → 20%, so dying particles break into ragged remnants. Licks align/stretch to
  velocity (stretch = 1 + min(1.15, 0.22·speed): monotone, 1 at rest, saturating).
  Burn state: 3.4s (cap 6.5), ticks at `AOE_R 1.55` ring; world-space fbm shell
  skin biting hardest at the top; noise-torn AOE ring peaking at the damage radius;
  scorch trail while rolling.
- **Lightning, two acts.** Act 1: recursive midpoint-displacement channel
  (disp 1.9 halving over 5 levels → 33 points, sky 11 → ground, strike point
  pinned, monotonically descending, 3–5 diving branches at half displacement),
  rendered as TWO ribbon layers over one path — near-white core inside a wide deep
  indigo corona (how discharge reads on white) — 15ms top-down reveal, 2 restrikes
  re-forming the channel, ~180Hz brightness chatter on REAL time (survives
  hit-stop). Act 2: decelerating front to 2.6 units over 0.45s spawning crawling
  tangent-biased ground arcs (life 50–140ms, aged on real time, ~90/s at the
  front), stepped "zap" sparks whose heading snaps ~30×/s from a NON-COMPOUNDING
  reference speed decaying only by drag (sampling current velocity compounded into
  both runaway AND collapse), and a streamer-trace ion decal.
- **Ground anchoring:** every ground-coupled effect (telegraphs, strike point,
  spread plane, decals, burn ring, landing `flat` anchor) reads `H()` — effects on
  a hill sit ON the hill.
- **Light budget:** pooled point lights; fire flickers on layered fast frequencies
  (29/47/11 Hz mix); strobes are hard random gates decaying out; colored light on
  the white floor is the primary "glow" substitute.
- **Hit-stop and screen flash** are impact punctuation; per-element weights (fire
  0.06 → physical 0.2 shake).

---

## 7. ANIMATION PRACTICES

Disney principles, applied and measured:

- **Anticipation:** 0.14s crouch before jumps; roll gathers squash before release.
- **Slow-in/fast-out** on rolls (the ease above); pivot arcs with a lift.
- **Follow-through / overlap:** shared squash spring reacts to every landing,
  scaled by drop height; burn aura lags the cube.
- **Staging:** the tumble completes at 88% of flight so landings are flat and the
  squash can do its job; sentry spin ramp is back-loaded (`k^1.6`, idle 0.5 →
  +12 rad/s ≈ 24×) so menace spikes late.
- **THE CRITICAL SEPARATION:** eases belong to BODIES, never to camera inputs. The
  roll ease pulses cube velocity 0 → 7.1 → 4.2 → 0 at 5.26Hz; any camera following
  the eased position inherits a visible pulse no first-order filter can remove.
  The camera consumes LINEAR progress (§8). Any new eased motion the camera might
  follow must obey this rule.

---

## 8. CAMERA AND FEEL (policy, with proofs)

- Fixed orientation, smooth pursuit: `camPos.lerp(wanted, 1 − e^(−5.2dt))`,
  look-ahead 0.85 toward movement, eased at 4/s.
- **Horizontal input = linear roll progress** (`rStart + dir·t/dur`), never the
  eased cube. Measured ripple during chained rolls: 0.723 u/s → 2.9e-5 (25,000×).
- **Vertical input = resting ground**, never `state.pos.y` (which carries arc lift
  and jumps): mid-roll the destination height, mid-air the landing column, eased at
  4.5/s (a terrace rise settles in ~0.88s — slower than the roll that caused it, so
  elevation reads as elevation). Flat ground: exactly zero camera bob.
- **Traversal NEVER shakes the camera.** Not "quietly" — at all. Per-move shake
  re-seeds per-frame random offsets 5×/s and reads as continuous dither. Shake is
  impact-only (all sources ≥ 0.05, labelled `// impact:` in source, QA-enforced),
  decays with a hard floor (< 0.004 → 0) so impacts end cleanly. One kick-spring
  exciter: taking damage.
- Hit-stop scales dt for the world; real-time drives electric chatter and arc aging.

---

## 9. WORLD, QUEST, AND PRESENTATION SYSTEMS

- **World state `W`:** structural `wall`/`gap` sets (+ meshes derive from `wall`
  ONLY), height map `W.h`, door state, stage machine
  (`seek → raise → travel → inside → done`), integrity 3 + i-frames 1.0s, anchor
  respawn, `found` ability set.
- **Slice layout (north = −Z):** start (0,0) → shrine (0,−7) stamps Fire onto the
  DOWN face (teaches the rule) and sets the anchor → 15-wide chasm at z=−12 (rolls
  refused; leap crosses; roll-only detour costs 36 vs 11 moves) → sentry gauntlet
  `[[2,−15],[−2,−15],[4,−18],[−4,−18],[1,−19]]` (never on the socket column) →
  socket (0,−20) wants Fire face-down (9 vs 7 moves, proven) → enclosed monolith
  chamber, door at (0,−22) → lightning glyph (0,−25) + color flood. Hills:
  terrace(7,−3,3), terrace(−7,−16,2).
- **Sentries:** 4-seg cones (r 0.86, h 1.8, flat facets), occupy cells dynamically,
  aggro < 6.5, capture a cross of cells ON the player at aim start, 1.5s windup
  (≥ 2 rolls + reading time; every reachable cell escapes in time), pulse floor
  cells AND their own body from ONE `TELE_COLOR 0xb8412a` (tint lerp capped 0.75 +
  emissive charge; resist shrug is frame-loop state, never setTimeout), red point
  light on firing, cooldown 1.6s (> i-frames, so never a double-hit), fire kills
  within `AOE_R + 0.8` (a good blast takes 2, never all 5), death frees the cell
  and drops scorch + debris.
- **Regions:** THE BLANK / THE GAUNTLET (z ≤ −12) / THE SEALED CHAMBER (interior
  only — an unbounded region test once titled the outside of the monolith).
  Announced once each, on first entry, large tracked type with a self-drawing
  rule; the doorway cell belongs to the chamber so the title lands crossing the
  seal; chamber title is provably gated by the door.
- **The Keeper (NPC):** an octahedron (a grammar the player can't read yet) at
  (3,−5), warm lantern light (foreshadowing color), occupies via `npcAt` (never
  `W.wall`), placement proven not to perturb any route or the puzzle. SPEAK
  button when adjacent (range 1.6 covers diagonals; hangup at 2.4 > range so no
  flicker), stage-aware line sets, dialogue captures ALL movement input; advancing
  by tap / Space / Enter / E / pad A.
- **HUD:** armed readout + UNDER face + 3 integrity pips (top-left), EQUIP + CAM
  (top-right), stage hints (footer; the opening stage is deliberately silent — the
  shrine's glow is the prompt), event banners, location titles.
- **Input:** touch D-pad (SVG plus frame, axis-locked knob — larger component wins,
  other zeroed; dead zone 0.36 = the input's own; arm width/travel matched to
  knob/STICK_R 40), tap-to-jump on canvas only, PIVOT button, WASD/arrows/Space/
  Shift/E/backtick. **Gamepad:** polled pre-step (the API is level-based —
  edge-detect against previous snapshot; poll grouped buttons with `.map` not
  `.some` or stale prev-state misfires), hat beats stick, stick axis-locked at
  dead zone 0.38, A jump/confirm, B pivot, Y speak (a dedicated speak button —
  A doing both swallowed jumps beside NPCs), Start/Select equip. `body.pad` class
  fades touch UI and shows button badges; connection announced by banner (hints
  are rewritten every frame). Blocked-by-policy environments: one call, one info
  line, permanent disable.
- **Persistence:** `{faces, found}` JSON in optional `window.storage`, validated on
  load (shape, known abilities, found-gating), silent in-memory fallback.

---

## 10. QA METHODOLOGY (the spine of the process)

The prototype's suites are the canonical specification of behavior; in production
they are ported into the §1.5 pyramid (Vitest units, fast-check properties, WASM
proof gates, Playwright E2E, golden-image visual regression). This section defines
WHAT is tested; §1.5 defines where it runs. ALL must pass to ship. Current roster and what each
owns: `qa` movement/leap/buffer · `qa-vfx` bolt/spread/zap · `qa-cam` camera,
grid, fog, shadows, shake policy, ripple · `qa-fire` plume physics + ramp +
erosion · `qa-equip` net topology + drag semantics + draft/commit · `qa-camdbg`
debug-panel math · `qa-dpad` axis lock · `qa-world` reachability, gating, socket
proof, orientation-lock proof, regions, Keeper, terrain rules, turret budget ·
`qa-toon` ramp + terrain readability · `qa-tint` palette contrast · `qa-pad`
gamepad.

Principles:
- **Prove, don't spot-check:** BFS over cell×orientation for every socket; parity
  lock demonstrated per space class; 20k-step mixed walks; 400-trial equalities at
  1e-9.
- **Test properties, not incidents** (stretch is monotone-in-speed, not "some slow
  particle exists").
- **Port the exact shader/formula** into JS and measure (coverage, band counts,
  contrast ratios, velocity ripple).
- **File audits** pin architecture: zero `MeshStandardMaterial`, one ramp, one
  `W.h.set` site, labelled shake sources, exactly one `toNonIndexed`.
- Worst-case modelling (all sentries alive) is allowed in QA maps but must be
  commented as modelling, with the real separation audited in the game file.

---

## 11. BUILD ORDER FOR AGENTS (phases with gates)

Each phase ships a working file and its suite; a phase gate = full regression green
plus that phase's proofs.

0. **Scaffolding:** monorepo, package boundaries + contract stubs, CI (lint,
   unit, visual harness, budgets), fixed-timestep sim loop with seeded RNG and
   replay, snapshot bridge, preview deploys. Gate: an empty game that ticks
   deterministically, replays byte-identically, and deploys on every PR.
1. **Foundation:** renderer (WebGPU + fallback), camera, grid floor, toon system
   in TSL, cube + baked face textures, HUD shell. Gate: qa-cam, qa-toon, qa-tint
   ports + first golden images.
2. **Movement:** roll/jump/leap/buffer/pivot + squash + refusals. Gate: qa, the
   leap-equals-two-rolls proof, the orientation-lock proof.
3. **Equip:** net overlay, drag/drop, draft/commit, persistence. Gate: qa-equip.
4. **VFX:** fire physics+render, lightning two acts, decals, lights. Gate: qa-fire,
   qa-vfx + stability sweep.
5. **World slice:** tiles, shrine, gauntlet, socket+door, regions, Keeper,
   integrity/respawn. Gate: qa-world in full (reachability, gating, socket proof,
   turret fairness).
6. **Terrain:** reference block, helpers, hills, readability shading, height-aware
   movement/effects/camera. Gate: terrain sections of qa-world + qa-toon; critical
   path numbers unchanged.
7. **Input breadth:** gamepad, prompts, modal capture. Gate: qa-pad.
8. **Feel pass:** shake policy, linear camera feed, ground tracking. Gate: qa-cam
   §§6–8 (policy, bob, ripple).
9. **Content expansion** (§12 order): new abilities → new enemy shapes → death/
   corpse-run → color-return meta → additional regions. Every new socket ships with
   its proof; every new shape ships with its movement-grammar QA.

---

## 12. DESIGN LEDGER

**Included in the slice (with the deciding reason):**
cube-only player d6 (pillar 2 purity) · Fire + Lightning + Physical + Normal ·
down-face sockets (fuses equip with rolling-cube puzzles) · PIVOT (provable
necessity) · blank-start + found-gated equip (equipping IS onboarding) · pyramid
sentries (simplest readable enemy grammar: static, telegraphed, element-gated) ·
one NPC archetype · three named regions · terraced elevation · anchor respawn with
integrity pips (soft death for the slice) · pad + touch + keyboard parity.

**Deliberately excluded from the slice (and why):**
- **Free camera / rotation** — fixed camera keeps stick mapping absolute and bakes
  six cheap orientation-dependent systems; rotation would force
  `recomputeCameraBasis` every frame and re-tuned readability.
- **Physics engine** — the grid IS the physics; determinism is what makes the
  proofs possible.
- **Smooth terrain/ramps** — violates rule 1; sub-cell height would break the
  quarter-turn invariant.
- **Analog (non-axis-locked) movement** — the cube cannot move diagonally; the
  input shape must tell that truth (D-pad lesson).
- **Outlines on the cube** — built (inverted hull, aspect-corrected, CSS-pixel
  pinned), then cut: the saturated body + halos read better; keep the technique in
  the archive, not the game.
- **Text tutorials** — pillar 4; the opening hint was removed on purpose.
- **Minimap/quest log** — discovery is the content; regions + landmarks navigate.

**Deferred (designed, not built — build in this order):**
1. **Ice** — AOE freezes a slick patch; rolling on it slides to the next dry cell:
   distance traded for face control. First because it's the only ability that
   changes MOVEMENT. Place opposite Fire to weaponize the axis-exclusion rule.
2. **Swap** — exchange up and down faces (the only instant route to the down face);
   pairs with sockets.
3. **Imprint** — stamp the last-used ability onto a Normal face: build your own die
   over a run.
4. **Sentries drop a Physical glyph** — first enemy-sourced ability.
5. **Death as corpse run** — abilities burn into the death tiles; return blank to
   reclaim them (loadout loss is too cruel when equip is identity).
6. **Bestiary by grammar:** octahedron (rolls diagonally — moves you can't),
   cylinder (charges straight lines), tetrahedron (maddening roll pattern), sphere
   (unconstrained — the terror), d12/d20 bosses. Every telegraph measured in
   roll-counts.
7. **Color-return meta** — persistent per-region color as exploration record;
   the flood behind the first door is its seed.
8. **Void / Gravity / Rot / Shatter** abilities; **Mirror** ghost-cube; further
   regions behind face-stamp seals of the new elements.

**Open questions for the next design pass:** should PIVOT be gated (found like an
ability) to let early corridors teach the lock before handing the key? Should leap
height-clearance scale with a future ability? Is 3 integrity right once enemies
multiply?

---

## 13. CANONICAL CONSTANTS (single source of truth)

In production these live in `@tumble/sim/constants.ts`, imported by content,
render, and tests alike — never restated locally.

Movement: ROLL_DUR .19 · rollEase t²(2.2−1.2t) · JUMP_V0 7.6 · GRAV 25 · hang 2.3
@ .62 · FLIGHT_DUR ≈ .72 · LEAP_CELLS 2 · JUMP_BUFFER .20 · TUCK_DUR .34 ·
squash 300/21. Camera: offset (0, 8, 15.45) · FOV 42 · aim .55 · follow 5.2/s ·
climb 4.5/s · lookahead .85 @ 4/s · fog 42/110 · shadow ±22/70, r 1.8, bias
−.0012. Combat: AOE_R 1.55 · kill pad +0.8 · TURRET aim 1.5 / cool 1.6 / range
6.5 · spin .5 → +12·k^1.6 · TELE 0xb8412a · i-frames 1.0 · integrity 3. Terrain:
SKY 1.0/.78/×.86/−.055 · peak ≤ 3 · CAM_CLIMB 4.5. Toon: [.62,.84,1.0]. Shake
floor .004; impacts .05–.20. Pad dead .38; touch dead .36; STICK_R 40.

— End of plan. An agent that keeps §1's contracts, determinism, and the QA
pyramid green may extend anything else; an agent that breaks the quarter-turn
invariant, the socket proofs, the sim/render boundary, or the camera policies is
regressing the game no matter what it adds — and the replay corpus will say so.
