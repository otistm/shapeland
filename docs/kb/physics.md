# High-Level Physics for Shapeland

Shapeland has no physics engine. The grid **is** the physics, and determinism is what makes the
level proofs possible. This document is the reference for everything that moves.

---

## 1. Fixed timestep

The renderer produces time; the simulation consumes it in discrete `DT`-sized steps.

```ts
const DT = 1 / 120;            // sim step, seconds
const MAX_FRAME = 0.25;        // spiral-of-death clamp
const MAX_STEPS = 8;           // hard step cap per frame

let acc = 0, tick = 0, prev = snapshot(state), cur = prev;

function frame(nowSec: number) {
  const frameTime = Math.min(nowSec - last, MAX_FRAME); last = nowSec;
  acc += frameTime;
  let steps = 0;
  while (acc >= DT && steps++ < MAX_STEPS) {
    prev = cur;
    step(state, tick++);        // pure; DT is a constant inside
    cur = snapshot(state);
    acc -= DT;
  }
  if (steps >= MAX_STEPS) acc = 0;   // drop debt rather than spiral
  render(lerpState(prev, cur, acc / DT));   // alpha in [0,1)
}
```

**Never accumulate sim time as a float.** `1/120` is not a dyadic rational, so `t += 1/120`
drifts. `tick` (integer) is the only clock; derive `t = tick * DT` only where needed, and prefer
integer-tick comparisons in all sim logic.

**Why variable `dt` breaks determinism:** behavior is a function of `dt`. Spring stability limits,
integrator truncation error, and penetration depth all scale with it, and floating-point addition
is not associative — a sum of unequal steps is not the sum of equal ones. A run is
`(seed, inputLog)`; that is only well-defined if step *k* always sees identical state and `dt`.

**Why 120Hz:** halves penetration depth and doubles spring stability headroom versus 60Hz, and
divides evenly into 60/120/240Hz displays. Stability budget: `hω ≤ 2` ⟹ `ω ≤ 240 rad/s` ⟹
`f ≤ ~38Hz`. Squash springs at 8–15Hz have wide margin.

**Two guards, both mandatory:** clamp the frame time, and cap steps per frame. The sim visibly
slows instead of hanging. The real remedy is headroom — budget so a step costs far less than `DT`.

---

## 2. Determinism engineering in TypeScript

### What is safe

`+ - * / %` and `Math.sqrt` on IEEE-754 doubles are correctly rounded and bit-identical
everywhere. JS has no fast-math, no FMA contraction, no flush-to-zero. `Map` and `Set` iteration
is spec-guaranteed insertion order. `Array.prototype.sort` is stable since ES2019.

### What is not

- **Transcendentals are explicitly unspecified by ECMA-262.** `sin, cos, tan, asin, acos, atan,
  atan2, exp, log, pow, cbrt, hypot, sinh, cosh, tanh` are "implementation-approximated". fdlibm
  is *recommended, not required*. V8 and SpiderMonkey use different ports; JavaScriptCore uses
  `cmath`. V8's own results have changed between versions. **This is the single biggest
  determinism risk in the stack.**
- Plain-object key order (integer-like keys iterate ascending numerically first).
- `NaN` — payload bits are non-portable, `NaN !== NaN`, and one NaN silently poisons every
  downstream hash.
- `Date.now`, `performance.now`, `Math.random`, `for…in`, async ordering, any GPU readback.

### Mitigations

- **Ban the hazards at the package boundary.** In `sim`, lint-ban `Math.random`, `Date`,
  `performance`, `document`, `window`, and the transcendental list. Provide `simMath` with
  fdlibm-derived `sin/cos/atan2/exp/log` built only from `+ - * / sqrt` and integer ops.
- **Prefer integer state over fixed-point emulation.** Most Shapeland state already *is* integer:
  cell coordinates, orientation index `0..23`, roll phase in ticks. Reach for Q16.16 in an
  `Int32Array` only where a real fraction is unavoidable.
- **Named RNG streams.** One global RNG means any consumer's call-count change desyncs
  everything. Derive per-domain streams by hashing a name into the state words, so systems can be
  added and removed independently.

```ts
function xmur3(str: string) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19;
  }
  return () => {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a |= 0; b |= 0; c |= 0; d |= 0;
    const t = (a + b | 0) + d | 0; d = d + 1 | 0;
    a = b ^ b >>> 9; b = c + (c << 3) | 0; c = c << 21 | c >>> 11; c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}
const s = xmur3(`${seed}:physics.debris`);
const rand = sfc32(s(), s(), s(), s());
```

**PRNG choice:** `sfc32` — 128-bit state, passes PractRand, fastest good option in JS. Avoid
`mulberry32`/`splitmix32` for long runs (2^32 period). Avoid `rand & 1` with any xorshift-family
generator (including `xoshiro128**`) — their low bits fail linear-complexity tests. PCG needs
64-bit math, which in JS means BigInt (slow) or an unverified split-word port; `sfc32` is safer.

**Float determinism scope:** bit-exact **within one engine family** (all V8 targets: Chrome, Edge,
Node, Deno, Electron) if transcendentals are avoided; **risky across** V8/SpiderMonkey/JSC.
Design for it, then validate with hash comparison rather than assuming it.

**State hashing:** hash the sim's `ArrayBuffer` through an `Int32Array` view with FNV-1a or
xxHash32 every tick; log `(tick, hash)`. On divergence, binary-search the first mismatching tick.
Normalize `-0` to `0` and reject NaN before hashing. Prefer **layered per-subsystem hashes** over
one total hash — that is what turns desync debugging from hours into minutes.

---

## 3. Integrators

| Scheme | Order | Stability | Energy | Use |
|---|---|---|---|---|
| Explicit Euler | 1 | unstable for oscillators | gains energy, blows up | never |
| Semi-implicit (symplectic) Euler | 1 | conditional, `hω ≤ 2` | conserves on average | **default** |
| Implicit Euler | 1 | unconditional | damps | stiff springs, soft constraints |
| Velocity Verlet | 2 | `hω ≤ 2` class | bounded drift | position-based systems |
| RK4 | 4 | larger region | drifts (non-symplectic) | not for games |

```ts
// semi-implicit Euler: velocity FIRST, then position with the NEW velocity
v += (F(x) / m) * DT;
x += v * DT;
```

Catto's priority order is explicit: **stability > performance > accuracy**. Any sim with rigid
collisions is already wildly inaccurate, so accuracy spend is wasted. Semi-implicit Euler is
symplectic — it conserves a *modified* energy exactly, giving bounded orbits deviating `O(Δt)`,
which is why there is no secular energy growth. Its numerical frequency is stiffened by
`1 + ω²Δt²/24`, which is why spring feel retunes slightly if `DT` changes.

---

## 4. Movement without a physics engine

Authoritative state is `{ cell: IVec3, orientation: u8 (0..23), rollPhase: int, rollDir }`. No
forces, no solver. Movement is a state machine: `Idle → Rolling(dir, phase) → Idle(cell+dir,
ROLL_D[o])`. Because the target cell and final orientation are computed at roll *start* from
integers, position and orientation can never drift — the cube lands exactly on the lattice by
construction.

**Parametric vs pivot-derived roll.** Pivot-derived (rotate about the contact edge) gives the
correct rolling bob for free and keeps one source of truth. Parametric (lerp position, slerp
orientation independently) is cheaper but clips the ground mid-roll unless the vertical arc is
hand-authored — which is exactly what Shapeland does, because height steps require it. Keep the
authored arc, and keep landing snapped from roll **start** so nothing accumulates.

**Jump arcs.** Design in feel units (peak height `h`, time-to-apex `t_a`), then solve:
`v₀ = 2h / t_a`, `g = 2h / t_a²`, `h = v₀²/(2g)`, airtime `= 2t_a`. Discretize `t_a` to an integer
tick count and derive `g` from it, so jumps are frame-exact.

**Hang time.** Celeste applies half gravity near the apex while jump is held. Variable height on
release: `vy = min(vy, vy * cut)` with `cut ≈ 0.4–0.5`.

**Coyote time and input buffering.** Celeste ships **5 frames at 60fps (~83ms)** for both coyote
time and its universal input buffer. Broader guidance: coyote 5–8 frames, buffer 6–9 frames
(100–150ms). **At 120Hz, double the tick counts** (coyote ~10 ticks, buffer ~12–16) and store them
as *tick* constants, never frames-at-60. Shapeland's `JUMP_BUFFER 0.20s` = 24 ticks, deliberately
longer than `ROLL_DUR` so any mid-roll press fires on grounding.

**Springs.** Second-order system `ẍ + 2ζω ẋ + ω²(x − x_t) = 0`, `ω = 2πf`. `ζ<1` underdamped
(overshoot — good for landing squash), `ζ=1` critically damped (fastest without oscillation),
`ζ>1` draggy. With mass: `k = mω²`, `c = 2ζmω`; critical damping is `c = 2√(km)`.

---

## 5. Smoothing math, exactly

**Frame-rate-independent exponential smoothing:**

```ts
x = target + (x - target) * Math.exp(-lambda * dt);   // === lerp(x, target, 1 - exp(-lambda*dt))
```

This composes correctly because `e^(−λd₁)·e^(−λd₂) = e^(−λ(d₁+d₂))`. `lerp(a, b, λ*dt)` does
**not** — at 144Hz it converges 2.4× faster than at 60Hz. Shapeland's camera follow
(`1 − e^(−5.2dt)`) is already in the correct form; keep it that way.

**Settle time → coefficient:**

- half-life `h`: `λ = ln2 / h`
- fraction `ε` remaining after `T`: `λ = −ln(ε) / T`; 1% in `T` ⟹ `λ = 4.605/T`
- critically damped spring, 1% settle in `T`: `ω ≈ 6.6 / T` *(derived, not sourced)*

**Unconditionally stable spring** (implicit Euler form; no `hω ≤ 2` limit):

```ts
function spring(s: {x: number; v: number}, xt: number, zeta: number, omega: number, h: number) {
  const f = 1 + 2 * h * zeta * omega;
  const oo = omega * omega, hoo = h * oo, hhoo = h * hoo;
  const detInv = 1 / (f + hhoo);
  const detX = f * s.x + h * s.v + hhoo * xt;
  const detV = s.v + hoo * (xt - s.x);
  s.x = detX * detInv; s.v = detV * detInv;
}
```

Even inside a fixed-timestep sim, prefer the `dt`-aware forms so retuning `DT` does not force
retuning every spring.

---

## 6. Collision and spatial queries

**Occupancy sets beat mesh collision.** A query is `solid.has(key(x,y,z))` — `O(1)`, no
narrowphase, no epsilon, no tunneling, and exactly reproducible because the answer is a boolean
over integers. Mesh/AABB collision reintroduces float comparisons, contact-ordering sensitivity,
and penetration resolution for no gameplay benefit in a lattice world.

**Key packing.** Avoid string keys. For a bounded world:
`key = (x+512) | ((y+512) << 10) | ((z+512) << 20)` (10 bits/axis, ±512 cells) in a
`Set<number>`. For larger worlds, chunk: `Map<chunkKey, Uint8Array>` with a flat
`x + 16*(y + 16*z)` index inside the chunk.

**Broadphase complexity.** Uniform grid / spatial hash: build `O(n)`, query `O(1 + k)` — ideal
when object size equals cell size, which is always true here. BVH: build `O(n log n)`, query
`O(log n)` — worth it only for raycasts against large irregular static geometry.

**Swept tests.** For anything crossing more than one cell per tick, march with 3D DDA
(Amanatides–Woo) — integer-driven, `O(cells crossed)`, returns first blocking cell and normal. The
grid-locked cube never needs this; projectiles and debris do.

Assert `maxSpeed * DT < cellSize` as a test invariant rather than hoping.

---

## 7. Plumes, fire, and cheap grounded VFX physics

- **Buoyancy.** `a = g·(T − T_amb)/T_amb` for an ideal gas at constant pressure.
- **Entrainment (Morton–Taylor–Turner 1956).** A top-hat plume entrains ambient at `u_e = α·w`.
  MTT inferred `α = 0.093`, commonly rounded to `0.1`. Modern reviews: `α = 0.1 ± 0.01` for
  developed plumes, `0.10–0.16` pure plumes, `0.065–0.080` jets. **Not universal** — reported
  values span `0.05–0.30` by regime. Per-particle version: `radius += α * speed * DT`, and mix
  toward ambient in proportion to entrained volume, which widens and cools with the right power
  laws automatically.
- **Cooling.** `T = T_amb + (T − T_amb)·exp(−DT/τ)`. 63% of the way in `τ`, 95% in `3τ`. Tie `τ`
  to the entrainment rate rather than picking it arbitrarily.
- **Puffing frequency — verified.** Pool fires pulse at `f = 1.5·D^(−1/2)` Hz with `D` in metres
  (Cetegen & Ahmed 1993; Trefethen & Panton 1990). A 0.5m brazier puffs at ~2.1Hz, a 2m bonfire at
  ~1.06Hz. Caveats: the **prefactor 1.5 is contested** (Byram & Nelson, Detriche & Lanore,
  Malalasekera and Joulain all report different factors) but the `f ∝ (g/D)^(1/2)` scaling is
  robust across 14 decades of Froude number, holds for `D ≈ 0.01–1m` across solid, liquid and
  gaseous fuels — confirming the oscillation is **fluid-dynamical, not chemical** — and ceases
  below a critical diameter. Drive the emitter's puff phase from `tick` and this `f` and the fire
  reads as the right *size*.
- **Vortex shedding.** The mechanism is a toroidal vortex born within one burner diameter,
  convecting upward, with accumulating buoyant gas forming the next. Cheap sim: spawn a vortex
  ring per puff period, advect particles with its induced velocity, decay strength exponentially.
- **GPU compute + CPU oracle.** WGSL specifies accuracy as ULP **intervals**, not exact results,
  permits fast-math, and has no per-shader opt-out. Therefore the GPU particle pass is
  **visually-only and must never be read back into sim state**. Architecture: (1) sim owns a small
  deterministic parcel set as the reference oracle, and it is what gameplay reads; (2) the GPU pass
  derives everything from `(seed, tick, particleIndex)` so it needs no persistent state; (3) tests
  assert the GPU field matches the oracle's *statistics* (mean height, spread, temperature
  profile) — agreement in distribution, never in bits.

---

## 8. Testing physics

**Property-based invariants** over random `(seed, inputLog)` pairs:

- *Replay identity:* `hash(run(seed, log)) === hash(run(seed, log))`.
- *Lattice invariant:* after every completed roll, `cell ∈ ℤ³` exactly and
  `orientation ∈ 0..23`. Integer state means **exact equality, no epsilon**.
- *No tunneling:* `|Δcell|₁ ≤ 1` per tick, and no occupied cell is ever entered.
- *Time-shift invariance:* the same log offset by `k` ticks produces the same trajectory offset
  by `k`.
- *Determinism under render load:* run with 1 step/frame and 8 steps/frame; hashes must match.
  **This is the test that catches `dt` leaking from render into sim.**

**Equalities like "leap equals two rolls"** must be asserted in the *strong* form, because state
is integer: `leap(from).cell === roll(roll(from)).cell` with exact equality, plus orientation index
equality. Epsilons belong only to derived float/visual quantities, where relative tolerance
`|a−b| ≤ max(1e-9, 1e-7·max(|a|,|b|))` is appropriate. Never use a loose epsilon on the integer
path — that hides exactly the desync class that matters.

**Energy drift.** Log `E = ½mv² + mgh` over ≥1e5 ticks and assert **bounded oscillation, not
monotone growth**: `max(E) − min(E) < tol` and regression slope ≈ 0. A regression that flips an
update to explicit ordering fails this immediately.

**Allocation-free hot path**, in order of reliability: (1) preallocate all state in typed arrays
and lint-ban object/array literals and `.map/.filter/.slice` inside `sim/hot/**`; (2) with
`--expose-gc`, run 1e6 ticks and assert a small `heapUsed` delta; (3) watch p99.9/p50 frame-time
ratio, since GC shows up as tail latency. Methods 2 and 3 are noisy and machine-dependent — treat
them as canaries, and rely on 1 for the actual guarantee.

**Golden replay corpus in CI.** Commit `(seed, inputLog, expectedTickHashes)` for representative
runs. Any physics change that alters behavior fails loudly and names the first divergent tick.
This is the single highest-value test for a deterministic game.

---

## Flagged / unverified

- Super Meat Boy's coyote duration (secondary sources only).
- Cylinder vortex-shedding `St ≈ 0.2` (textbook value, not source-checked).
- A well-tested 32-bit-ops JS PCG port could not be located.
- Pool-fire prefactor `1.5` — scaling robust, prefactor contested.
- Entrainment `α` — regime-dependent, not a constant.
- `ω ≈ 6.6/T` for 1% critical-damping settle — derived here, not quoted.

## Sources

- Glenn Fiedler, *Fix Your Timestep!* — https://gafferongames.com/post/fix_your_timestep/
- ECMA-262, Numbers and Dates — https://tc39.es/ecma262/multipage/numbers-and-dates.html
- Rune, *Making JS deterministic for fun and glory* — https://developers.rune.ai/blog/making-js-deterministic-for-fun-and-glory
- Phasm, *Deterministic Math for WASM* — https://phasm.app/blog/deterministic-cross-platform-math-wasm
- Tom MacWright, *Math keeps changing* — https://macwright.com/2020/02/14/math-keeps-changing
- bryc, *jshash/PRNGs* — https://github.com/bryc/code/blob/master/jshash/PRNGs.md
- Erin Catto, *Numerical Methods* (GDC 2015) — https://box2d.org/files/ErinCatto_NumericalMethods_GDC2015.pdf
- Erin Catto, *Soft Constraints* (GDC 2011) — https://box2d.org/files/ErinCatto_SoftConstraints_GDC2011.pdf
- Symplectic Euler method — https://en.wikipedia.org/wiki/Semi-implicit_Euler_method
- Freya Holmér, *Lerp smoothing is broken* — https://www.youtube.com/watch?v=LSNQuFEDOyQ
- Rory Driscoll, *Frame Rate Independent Damping using Lerp* — https://www.rorydriscoll.com/2016/03/07/frame-rate-independent-damping-using-lerp/
- Allen Chou, *Precise Control over Numeric Springing* — https://allenchou.net/2015/04/game-math-precise-control-over-numeric-springing/
- Maddy Thorson, *Celeste & Forgiveness* — https://www.maddymakesgames.com/articles/celeste_and_forgiveness/
- Cetegen & Ahmed, *Periodic instability of buoyant plumes and pool fires* (1993) — https://www.osti.gov/biblio/6537545
- Morton, Taylor & Turner (1956) — https://royalsocietypublishing.org/doi/10.1098/rspa.1956.0011
- *Unsteady turbulent buoyant plumes*, JFM — https://people.maths.bris.ac.uk/~maajh/PDFPapers/JFMUnsteadyPlumes.pdf
- WebGPU CTS, *Floating Point Primer* — https://chromium.googlesource.com/external/github.com/gpuweb/cts/+/refs/heads/async-errors/docs/fp_primer.md
- WGSL spec, Floating Point Evaluation — https://www.w3.org/TR/WGSL/
