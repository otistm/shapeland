# Level Design Practice

Theory and numbers live in [open-world-pacing.md](open-world-pacing.md) and
[architecture-and-construction.md](architecture-and-construction.md). This document is the
**workflow**: how a Shapeland space gets built, validated, and signed off.

---

## 1. The five terrain rules (non-negotiable)

Terrain is BUILT from stacked unit cubes, LEGO-fashion.

1. **Heights are integers** ≥ 0. No half-steps, no ramps, ever.
2. **A slope is a staircase.** ±1 steps roll with the same quarter-turn, so elevation never touches
   orientation math.
3. **A cliff (|Δh| ≥ 2) is a wall, in both directions.** No unexitable pits.
4. **Leaps respect the arc:** clear a mid cell ≤ start+1, land ≤ start+1, drop any distance.
5. **Terrain keeps 2 cells of air** from gap rows, structure, doors, sockets, pickups, NPCs,
   sentries, and the start.

Rule 1 is load-bearing for the whole game: sub-cell height would break the quarter-turn invariant,
which would break every socket proof. A designer who wants a ramp wants a staircase.

Author terrain **only** through the sanctioned helpers (`terraceHill(cx, cz, peak)` with `peak ≤ 3`,
and `raiseRect`) writing into the single height map. One write site, always. Every summit must be
BFS-reachable.

---

## 2. Blockout workflow

Copy this checklist per space:

```
- [ ] 1. Beat map: what the player feels, in order, with cell distances
- [ ] 2. Metrics pass: every gap, ledge, corridor from the metrics table
- [ ] 3. Blockout in the grid editor, untextured, true scale
- [ ] 4. Reachability proof green (BFS over cell x orientation)
- [ ] 5. Socket proofs green (every seal, with solveMoves bounds)
- [ ] 6. Pacing audit green (beat spacing, occlusion budget, dead-end loot)
- [ ] 7. Readability pass: one-glance test at every threshold
- [ ] 8. Sign-off by Level Design Lead -> only now may art start
- [ ] 9. Post-art re-run of steps 4-6 (art must not change reachability)
```

**Step 8 is a hard gate.** The classic failure is a blockout that dies in the art pass because
metrics were never respected. Art starting before gameplay sign-off is the single most expensive
mistake available to this discipline.

---

## 3. Proofs, not spot-checks

Shapeland's level design is unusual in that **correctness is provable**, so it must be proved.

**Reachability.** Every space ships a BFS over `(cell × orientation)` state space — pack state as
`(y * W + x) * 24 + o`, four successors per state via the roll tables. A 256×256 region is ~1.57M
states, trivially traversable in a typed array, and only ~786K are reachable after parity. Assert:
every intended destination reachable, every summit reachable, no unexitable pit.

**Socket solvability.** A face-stamp socket opens only when a required ability is pressed
face-DOWN on the socket cell. Solvability is never assumed. Every socket ships a BFS proof
asserting:

- `solveMoves > arriveMoves` — the constraint must **cost** something. A socket whose shortest
  arrival happens to satisfy it is hollow.
- `solveMoves ≤ arriveMoves + 6` — maneuvering, not a maze. Six is not arbitrary: the worst of the
  12 origin-reachable orientations needs exactly **6 rolls** to return, so `+6` is the natural
  budget ceiling.

Layout changes re-run the proof. **Enemy placement is part of puzzle balance** — a sentry on the
socket's own column once trivialized a puzzle by forcing a parity-fixing detour.

**The parity law you must design around.** A roll is an odd permutation of the cube's body
diagonals, so orientation parity is a function of the cell's checkerboard color:
`PARITY[o] === (−1)^(x+z)`. Consequences:

- All **6 up-faces are reachable at every cell**, but only **2 of the 4 spins** for each.
- Only **12 of 24** orientations are reachable at any given cell.
- **No 4-cycle exists on a 2×2 block** — a cube cannot return to a cell by circling one. The
  shortest state-graph cycle is length **8** (the maximum cycle on a 3×3 grid); next is 10.
- Therefore **PIVOT is mandatory, not optional.** In a corridor with no loop, each cell admits
  exactly one down face, and a corridor socket would be unopenable. Pivot (an in-place 90° yaw) is
  the odd element that restores all 24. A rolling-only cube on a square grid can *never* fix this,
  because every closed walk on a square lattice has even length.

**Complexity budget for puzzle generation.** Rolling-cube puzzles where cells may be revisited are
**polynomial** (plain BFS) — computer-easy but human-hard, which is exactly the target. Requiring
labeled cells be visited **exactly once** is **NP-complete**, and multiple rolling blocks is
**PSPACE-complete**. Do not build a generator that needs exactly-once coverage unless you accept
NP-hardness.

---

## 4. Pacing audit

Run against [open-world-pacing.md](open-world-pacing.md)'s nested budget. At 0.19s/cell
(5.263 cells/s):

| Layer | Cadence | Content |
|---|---|---|
| Micro | ~16 cells (3s) | something changes what the player is *doing* |
| Life | ~50–105 cells (10–20s) | visible motion enters frame |
| POI | ~150–210 cells (30–40s) | a committable point of interest. **Hard ceiling.** |
| Named | ~950 cells (3min) | region threshold, boss gate, district transition |

Additional asserts:

- **Occlusion budget: 50–70% of local landmarks hidden at any moment.** Cube and rectangular
  masses for total concealment (surprise); terraced pyramids for gradual reveal (anticipation).
- **Reveal cadence per landmark:** show → occlude for 30–60 cells → re-reveal from a new angle,
  three times.
- **Every safe node needs one 60+ cell prospect.** A checkpoint you cannot see out of is a
  navigation dead spot.
- **100% of dead ends carry consolation content.** Zero exceptions, and zero progression-critical
  items in a dead end.
- **Audio emitter at ~1.5× visual reveal radius** on every POI, because occlusion is high in a cube
  world.

---

## 5. Readability: the one-glance test

At every threshold, **one screen** must answer three questions: where can I go, where is the goal,
what is dangerous. If it does not, the space is not done.

On a white grid the only available signals are **form, height, shadow, and (sparingly) color**:

- **Elevation must be readable.** With the key light at 52°, a top and its sun-facing side share a
  toon band, so an all-white column has an invisible edge. Sky exposure is baked into the albedo:
  tops 1.00, vertical faces 0.78, crevice falloff ×0.86 per unit, −0.055 per unit below the summit,
  plus seam lines per course and contact occlusion. Result: 1.27:1 lit-side edge, 1.97:1 shaded,
  adjacent courses countable at 7%.
- **Course every surface over 8u in visible 1u bands** so height stays countable. A smooth 40u wall
  is unreadable; a banded one reads as 40 units tall.
- **Coursing pattern signals physics.** Running bond (half-unit offset) reads *load-bearing, real*.
  Stack bond (aligned joints) reads *veneer, inert*. Use running bond on structural mass and stack
  bond on monoliths and seals, so the pattern tells players which surfaces obey physics.
- **Color is the loudest signal the game can spend.** One colored cell in a white field outranks
  any amount of geometry. Reserve it for seals and earned traces.

---

## 6. Encounter placement

- **Bosses first, map second.** Decide where an encounter lives, then grow the space outward from
  it. This is FromSoftware's documented order and it prevents arenas that are retrofitted into
  corridors.
- **Sentry windup must exceed reading time.** 1.5s windup is ≥ 2 rolls plus reading time, and
  **every reachable cell must escape in time** — that is an assertion, not an intention.
- **Cooldown must exceed i-frames** (1.6s vs 1.0s), so a player can never take a double hit from
  one source.
- **A good blast takes 2 sentries, never all 5.** Group placement so skill is rewarded and
  luck is not required.
- **Never place an ambush unsurvivable on first contact with correct reflexes.** Information denial
  is fair; unavoidable damage is not.
- **Density zoning: one maximum-density node per region**, with the approach to a boss deliberately
  sparse.

---

## 7. Structural honesty

The world is stacked cubes, so it must obey stacking:

- **Corbelling, not cantilevers.** Maximum **1 cell of step-out per course**, with backing mass at
  least **3× the projecting mass**, over at least 4 courses. The block-stacking result is the
  reason: four cubes buy only ~1.04 units of honest projection, and 4 units of overhang would need
  31 blocks.
- **Arches:** a span `S` needs `S/2` of abutment on each side.
- **Lintels** ≤ 3u, 5u absolute maximum.
- **Piers:** footprint `d` supports `7d–10d` of height at `2.25d–3d` spacing.

Structural plausibility is not pedantry here — it is the difference between a world that reads as
built and one that reads as floating.

---

## 8. Definition of done

- Beat map written with cell distances.
- Blockout meets every number in the metrics table.
- Reachability proof green; every socket proof green with bounds asserted.
- Pacing audit green (spacing, occlusion, dead-end coverage).
- One-glance test passes at every threshold.
- Critical-path move counts recorded, so later changes can be diffed against them.
- Per-view performance within budget.
- A recorded playthrough with no blockers, committed to the replay corpus.

---

## Related

- [open-world-pacing.md](open-world-pacing.md) — the 30–40 second rule, landmark bands, density
- [architecture-and-construction.md](architecture-and-construction.md) — the metrics table, corbelling math, FromSoft techniques
- [geometry.md](geometry.md) — roll tables, parity theorem, BFS state packing
- [influences.md](influences.md) — Miyazaki's world structure and information design
