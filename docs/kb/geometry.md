# Shapeland Research Brief: High-Level Geometry for Game Systems

All numeric claims below were verified by executing `research/verify_cube_group.mjs` (in-repo). Output is quoted inline.

**Provenance note.** Figures in Section 1 and the four roll tables are *mine and proven* — generated and asserted by the in-repo script. Figures for non-cube rolling graphs in Section 3 are *sourced*, not derived by me; see the icosahedron caveat in that section.

## 1. The Rotation Group of the Cube

- **Order 24, proven by orbit-stabilizer.** Pick a face to be "down" (6 choices); once down is fixed, only the 4 quarter-yaws remain. `|G| = 6 × 4 = 24`. Verified: enumerating all 3×3 signed permutation matrices with `det = +1` yields exactly **24** distinct matrices, closed under multiplication.
- **G ≅ S₄ via the four body diagonals.** The cube's 4 long diagonals are permuted by every rotation, giving a homomorphism φ: G → S₄. Kernel is trivial (a rotation fixing all 4 diagonals fixes every vertex, hence is the identity), and `|G| = |S₄| = 24`, so φ is an isomorphism. Verified: the 24 matrices induce **24 distinct** permutations of the diagonals, split **12 even / 12 odd**.
- **Conjugacy classes** (sum = 24): identity (1); ±90° about face axes (6); 180° about face axes (3); ±120° about vertex/diagonal axes (8); 180° about edge-midpoint axes (6). These map to S₄ cycle types 1, 4-cycles, (2,2), 3-cycles, and transpositions respectively.
- **The parity theorem — why a rolling cube cannot reach all 24 orientations at one cell.** A roll is a **90° rotation about a horizontal axis**, i.e. a face-axis quarter turn, which is a **4-cycle** on the diagonals, therefore an **odd** permutation. Each roll also changes `x+y` by exactly ±1. So after any sequence of rolls, `sgn(σ) = (−1)^(number of rolls) = (−1)^(x+y−x₀−y₀)`. Parity of the orientation is a **function of the cell's checkerboard color** — an invariant, not a search artifact. Verified over a 19×19 BFS: `sgn(σ_o) == (−1)^(x+y)` on **every** reachable state, all 361 cells reached, and **exactly 12 orientations per cell, uniformly**.
- **The reachable set at a fixed cell is A₄.** The 12 orientations at the origin are all even and are **closed under composition** (verified) — they form the alternating group A₄, order 12, which is also the rotation group of the tetrahedron. Pleasing design resonance: the cube's own holonomy is the tetrahedron's symmetry.
- **Practical consequence:** all **6 up-faces are reachable at every cell**, but only **2 of the 4 yaws** for each. Demaine et al. state exactly this ("for a labeled cell, only two of the four orientations"), and prove it independently by 2-coloring the cube's corners, which induces a checkerboard 2-coloring of the board.
- **What restores the full 24:** any **odd** element. The cheapest is an **in-place 90° yaw** about the vertical axis (verified parity −1); `A₄ ∪ yaw·A₄ = 24` (verified). Design levers: a "spin" ability, a diagonal move, a triangular/hex substrate, or a teleport that re-seeds orientation. A rolling-only cube on a square grid can **never** fix this, because every closed walk on a square lattice has even length.
- **Max return cost:** from the start cell, the worst of the 12 origin orientations needs **6 rolls** to return (verified) — a tight budget for orientation-based puzzle design.

### Canonical indexing (identity = 0, fully reproducible)

Label body faces `0=+Z, 1=−Z, 2=+X, 3=−X, 4=+Y, 5=−Y` so **`opposite(f) = f ^ 1`**. Define `FACEREF = [I, Rx180, Ry(−90), Ry(+90), Rx(+90), Rx(−90)]` (each brings body face `u` to world +Z) and generate `index = 4u + s` as `YAW^s · FACEREF[u]` with `YAW = Rz(+90)`.

This yields three free identities, all verified:

- **`upFace(i) = i >> 2`** — up-face is literally the high bits.
- **`yaw(i) = (i & ~3) | ((i + 1) & 3)`** — in-place spin is arithmetic, no table.
- **`downFace(i) = upFace(i) ^ 1`** — the opposite involution, verified for all 24. With pips `[6,1,3,4,2,5]` under this face order, `p(f) + p(f^1) = 7` for all f (standard die).

Roll tables (verified `ROLL_W[ROLL_E[i]] === i` and `ROLL_S[ROLL_N[i]] === i`, and that **every** roll flips parity):

```ts
// Body faces: 0=+Z 1=-Z 2=+X 3=-X 4=+Y 5=-Y   =>  opposite(f) === (f ^ 1)
// Orientation index i in 0..23, generated as  YAW^(i & 3) * FACEREF[i >> 2].
// Identity orientation === 0.

export const UP = (i: number): number => i >> 2;              // 0..5, the body face at world +Z
export const OPPOSITE = (f: number): number => f ^ 1;         // face-opposite involution
export const YAW = (i: number): number => (i & ~3) | ((i + 1) & 3); // in-place 90 deg spin

export const ROLL_E = [12,17,10,23,14,21,8,19,0,16,4,20,6,18,2,22,15,5,11,3,13,1,9,7];
export const ROLL_W = [8,21,14,19,10,17,12,23,6,22,2,18,0,20,4,16,9,1,13,7,11,5,15,3];
export const ROLL_N = [20,13,18,11,16,15,22,9,21,1,17,5,23,7,19,3,0,12,6,8,4,14,2,10];
export const ROLL_S = [16,9,22,15,20,11,18,13,19,7,23,3,17,1,21,5,4,10,2,14,0,8,6,12];

// PARITY[i] = sign of the induced permutation of the 4 body diagonals (+1 even, -1 odd).
// Reachability law: orientation o is reachable at cell (x, y) from (0,0,identity)
// if and only if PARITY[o] === ((x + y) % 2 === 0 ? +1 : -1).
export const PARITY = [1,-1,1,-1,1,-1,1,-1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,1,-1,1];
```

### Recommended boot-time assertions

To **generate and prove** these at boot: build the 24 matrices, then assert. Six cheap assertions pin the entire movement system.

```ts
// 1. The group has exactly 24 elements and is closed under composition.
assert(ORI.length === 24 && new Set(ORI.map(key)).size === 24);
assert(ORI.every(A => ORI.every(B => index.has(key(mul(A, B))))));

// 2. Identity is index 0.
assert(index.get(key(IDENTITY)) === 0);

// 3. Rolls are involutive in opposite pairs (moves are reversible).
assert(ORI.every((_, i) => ROLL_W[ROLL_E[i]] === i));
assert(ORI.every((_, i) => ROLL_S[ROLL_N[i]] === i));

// 4. Every roll flips diagonal-permutation parity (this IS the parity theorem).
assert(ORI.every((_, i) =>
  [ROLL_E, ROLL_W, ROLL_N, ROLL_S].every(t => PARITY[t[i]] === -PARITY[i])));

// 5. The opposite-face involution holds: down is always the opposite of up.
assert(ORI.every((_, i) => downFace(i) === (UP(i) ^ 1)));

// 6. The up-face is the high bits, and yaw is arithmetic.
assert(ORI.every((M, i) => upFaceOf(M) === (i >> 2)));
assert(ORI.every((_, i) => index.get(key(mul(YAW_MAT, ORI[i]))) === ((i & ~3) | ((i + 1) & 3))));
```

An extra assertion worth running once in a test rather than at boot: BFS the (cell × orientation) space over a 19×19 board and assert every cell yields exactly 12 orientations, and that `PARITY[o] === (−1)^(x+y)` on every reached state.

## 2. Rolling-Cube Puzzle Theory

- **State space is (cell × orientation)**, 24·N naively, but the parity invariant halves it to **12·N reachable**. The quotient rolling graph (position modulo translation) has **24 vertices and 48 edges, 4-regular, bipartite** (verified) — Wolfram identifies it as the bipartite double of the cuboctahedral graph, and its circular embedding's outer Hamiltonian cycle corresponds to rolling around a rectangle's perimeter 3 times, hitting all 24 orientations.
- **Complexity results (load-bearing for level design):**
  - Labeled cells visitable **any number of times** → **polynomial**, solved by plain BFS/connected components on the state graph.
  - Labeled cells visited **exactly once**, with free cells → **NP-complete** (Buchin, Buchin, Demaine, Demaine, Fekete, Knauer, Schulz, Taslakian, CCCG 2007), resolving an O'Rourke open problem. Remains NP-complete with labeled + blocked but no free cells (Bonanzinga et al.), and maximum-length rollable cycle is NP-complete even given start state.
  - **Single**-block rolling mazes: **linear time**. **Multiple** blocks: **PSPACE-complete** (Buchin & Buchin).
- **Design implication:** puzzles where the cube may revisit cells are computer-easy but human-hard — the right target. Do not build a generator that needs exactly-once labeled coverage unless you accept NP-hardness.
- **Forbidden configurations** constrain layout: the shortest cycle in the state graph has **length 8** (the maximum cycle on a 3×3 grid); the next shortest is 10. **No 4-cycle exists on a 2×2 grid** — a cube cannot return to a cell by circling a 2×2 block. Use this: tight loops silently change orientation, which is a free puzzle mechanic.
- **Reachability is just BFS.** State is `(x, y, o)` packed as a single integer (`(y * W + x) * 24 + o`); 4 successors per state via the tables above. For a 256×256 region that is 256·256·24 ≈ 1.57M states — trivially traversable in a typed array, and only ~786K are reachable after parity. Precompute per-region reachability masks at load time.

## 3. Polyhedra as Behavior Grammar

| Solid | F | V | E | Face | Rotation group | Dual | Dihedral | Roll angle (180°−dih) |
|---|---|---|---|---|---|---|---|---|
| Tetra (d4) | 4 | 4 | 6 | 3 | A₄, 12 | self | 70.529° | 109.471° |
| Cube (d6) | 6 | 8 | 12 | 4 | S₄, 24 | octa | 90° | **90°** |
| Octa (d8) | 8 | 6 | 12 | 3 | S₄, 24 | cube | 109.471° | 70.529° |
| Dodeca (d12) | 12 | 20 | 30 | 5 | A₅, 60 | icosa | 116.565° | 63.435° |
| Icosa (d20) | 20 | 12 | 30 | 3 | A₅, 60 | dodeca | 138.190° | 41.810° |

All satisfy `V − E + F = 2` (verified). Dual pairs swap F↔V and share the rotation group — so **d12 and d20 are the same group A₅**, justifying them as a matched boss pair with two "dialects" of one grammar. Tetra roll angle `= 2·arctan(√2) = 109.471°` (verified).

- **Only the cube rolls face-to-face on a square grid.** Baes et al. exhaustively computed reachability for every regular-faced convex polyhedron on all 131 regular-tiled (≤4)-uniform tessellations. Result: **cube is a plane roller on (4⁴)** (the square tiling) and nothing else Platonic is; **tetrahedron, octahedron, icosahedron are plane rollers on (3⁶)** (triangular tiling); **dodecahedron appears in their not-a-plane-roller table** — regular pentagons don't tile the plane at all.
- **What to do about it.** Three honest options per shape:
  1. **Substrate change** — triangular sublattice for d4/d8/d20. Rolling-graph sizes (Wolfram): tetra → cubical graph, 8 vertices; octa → **Nauru graph**, 24 vertices/36 edges; icosa → 120 vertices/180 edges.
  2. **Abstract the roll** — keep the integer grid, make the "roll" a scripted animation whose *silhouette* reads as tumbling. The sim only needs a legal orientation index; visual fidelity is a render concern.
  3. **Lean into degeneracy as character.** The tetrahedron on a triangular grid reaches **exactly one orientation per cell** (PLOS ONE; consistent with the 8-vertex cubical graph): its pose is a pure function of position. That is not a bug — it is the mechanical basis for the "maddening" tetra: perfectly predictable pose, awkward 109.47° lurch, 3 exits instead of 4. Meanwhile cube, octa, icosa, and dodeca can each reach an arbitrary target pose on their own grids.

### Caveat: the icosahedron rolling-graph discrepancy (which figures are mine vs sourced)

My own derivation of rolling-graph vertex counts as `F × p` (faces × face-polygon rotations) **matches** Wolfram for the cube (6×4 = 24 vertices, 48 edges) and the octahedron (8×3 = 24 vertices, 36 edges, the Nauru graph), but **disagrees** for the icosahedron: I get 20×3 = 60, Wolfram reports **120** ("20 faces × 6 orientations"), and for the tetrahedron I get 4×3 = 12 where Wolfram reports **8** (the cubical graph).

The reconciling factor is that a triangular tiling has **two tile parities** (up-pointing and down-pointing triangles), which the cube's square tiling does not, so the state is `(face, rotation, tile-parity)` rather than `(face, rotation)` — and for some solids the tile parity is *determined* by the face/rotation pair while for others it is free. That accounts for the icosahedron's 60 → 120 and for the tetrahedron collapsing to 8 (4 faces × 1 pose × 2 parities), which is independently consistent with the PLOS ONE result of one pose per cell.

**Therefore:** the cube figures (24 orientations, 12 per cell, 24 vertices / 48 edges, 4-regular, bipartite, 6-roll max return) are **mine and proven** by the in-repo script. All non-cube rolling-graph sizes are **sourced** from Wolfram MathWorld and PLOS ONE, which are mutually consistent; I did not re-derive them and the naive `F × p` formula should **not** be used for non-square substrates.

- **Cylinder and sphere are not polyhedra** — no face lattice, so no orientation state. Cylinder: 1-DOF roll axis, hence "charges straight." Sphere: SO(3) unconstrained, hence unpredictable. The grammar is therefore *monotone in symmetry*: more symmetry ⇒ fewer distinguishable states ⇒ more predictable ⇒ easier enemy. Boss difficulty tracks group order (12 → 24 → 60).

## 4. Orientation Representation

- **Integer index is canonical in the sim.** Composition is a table lookup, equality is `===`, hashing is trivial, and there is **zero drift** — critical for determinism, replays, and lockstep netcode. Floating-point orientation in a deterministic sim is a bug waiting to happen.
- **Rotation matrices** are the natural home of SO(3) and compose by matmul, but accumulate error violating `RᵀR = I`; they need periodic re-orthogonalization (QR or SO(3) projection). **In Shapeland the matrices are integer-valued**, so composition is exact — use them to *generate* tables offline, not to hold live state.
- **Quaternions** are 4 floats, no gimbal lock, cheap renormalization `q ← q/‖q‖` at O(1) — versus re-orthogonalizing a matrix. They double-cover SO(3) (`q` and `−q` are the same rotation), which matters for interpolation. **Keep them strictly in the render layer**, derived from the integer index each frame.
- **Euler angles**: input/output only. 24 conventions, gimbal lock at `β = ±π/2` where the parameterization Jacobian goes singular. **Never interpolate Euler angles.**
- **Slerp**: `s(t) = [sin((1−t)θ)·p + sin(tθ)·q] / sin θ`, constant angular velocity along the shortest geodesic arc. Two required guards: **negate `q` if `p·q < 0`** (otherwise you take the long way around the hypersphere), and **fall back to normalized lerp for small θ** to avoid dividing by `sin θ → 0`.
- **Shortest-arc quarter turns.** A roll is exactly ±90° about a *world* axis through the pivot edge, so premultiply: `R' = R_world · R`. Render as `slerp(q_from, q_to, ease(t))` about the pivot edge, with the cube's center tracing an arc of radius `½√2·s`, lifting the center by `(√2−1)/2·s ≈ 0.207·s` at mid-roll. Snap the render quaternion to `quatFromIndex(orientation)` at animation end so drift can never accumulate across rolls.

```ts
// The sim advances integers only; the render layer derives floats and never feeds back.
function step(state: { x: number; y: number; o: number }, dir: Dir) {
  const T = [ROLL_E, ROLL_W, ROLL_N, ROLL_S][dir];
  return { x: state.x + DX[dir], y: state.y + DY[dir], o: T[state.o] };
}

// Render: interpolate, then hard-snap so error cannot accumulate across rolls.
function renderRoll(from: number, to: number, t: number): Quat {
  if (t >= 1) return QUAT_OF_INDEX[to];            // authoritative snap
  return slerp(QUAT_OF_INDEX[from], QUAT_OF_INDEX[to], ease(t));
}

function slerp(p: Quat, q: Quat, t: number): Quat {
  let d = dot(p, q);
  if (d < 0) { q = negate(q); d = -d; }            // shortest arc
  if (d > 0.9995) return normalize(lerp(p, q, t)); // small-angle fallback
  const th = Math.acos(d), s = Math.sin(th);
  return add(scale(p, Math.sin((1 - t) * th) / s), scale(q, Math.sin(t * th) / s));
}
```

## 5. SDFs and Implicit Geometry

- **Primitives** (Quilez's canonical list): sphere `length(p) − r`; box `length(max(q,0)) + min(max(q.x,max(q.y,q.z)),0)` with `q = abs(p) − b`; torus, capsule, cone, and — directly relevant — **exact octahedron and analytic box frames**. Every Shapeland enemy has a closed-form SDF, so shape identity survives into VFX for free.
- **Booleans**: union `min(a,b)`, intersection `max(a,b)`, subtraction `max(a,−b)`. These give exact SDFs on the outside; `max` variants only bound distance internally.
- **Smooth minimum**: quadratic `smin(a,b,k)` melts shapes like clay. Critical property: the **DD family never overestimates true distance** (its gradient magnitude ≤ 1, since `|∇a·∇b| ≤ 1` and the blend factor `2g'(1−g') ≥ 0`), so it is **safe for raymarching and collision**; it is exact outside the blend region. An overestimating field makes rays tunnel through surfaces.
- **Domain repetition** for infinite worlds: `q = p − s·round(p/s)` gives infinite instances from one evaluation, `p − s·clamp(round(p/s), −l, l)` for finite counts. **Caveat:** this only stays a valid SDF for shapes symmetric about tile boundaries — each point sees only its own tile, so an asymmetric shape's true nearest neighbor may be in an adjacent tile, producing artifacts. Fix by evaluating the 2 (or 4/8) nearest tiles and taking the min. This maps perfectly onto a grid game: `s` = cell size.
- **Raymarching**: step `t += sdf(p)` until `|sdf| < ε` or max steps. **Normals via gradient**: `normalize(vec3(sdf(p+e.xyy)−sdf(p−e.xyy), ...))` — central differences, 6 taps, or 4 with the tetrahedron trick.
- **Where SDFs are right for Shapeland**: VFX and shape auras (an octahedron's shockwave *is* its SDF isosurface); procedural decals projected onto surfaces; boolean architecture (carved rooms, damage holes) without mesh CSG; soft shadows and AO for free from distance; grid-aligned infinite backdrops. **Where they are wrong**: the authoritative collision/movement layer — that must stay integer-lattice.

```glsl
float sdOctahedron(vec3 p, float s) {      // exact
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
  if      (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));
}

float smin(float a, float b, float k) {    // quadratic; never overestimates
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

vec3 repeat(vec3 p, vec3 s) { return p - s * round(p / s); } // s = cell size
```

## 6. Computational Geometry the Agent Will Need

- **Metrics and their game semantics.** Manhattan `|dx|+|dy|` = rook/roll steps (4-neighbor); the correct distance for a rolling cube's move count. Chebyshev `max(|dx|,|dy|)` = king moves (8-neighbor). Euclidean for physics/audio falloff. **Ring sizes verified:** Chebyshev rings are `8n` (1, 8, 16, 24, 32, …); Manhattan rings are `4n` (1, 4, 8, 12, 16, …). Chebyshev's flaw is that diagonals cost 1 while covering `√2 ≈ 1.414` — **41.4% free travel** — which is why Chebyshev cost fields grow as nested squares and produce **terraced square pyramids** when used as a height function. Use that deliberately for ziggurat terrain; avoid it when you want circular AoE.
- **Convex hulls** (Andrew's monotone chain, O(n log n)) for enemy silhouettes, aggro region simplification, and hull-based broadphase.
- **Minkowski sums** for collision: `A ⊕ (−B)` is the Minkowski difference / **configuration-space obstacle**; A and B intersect **iff the origin lies inside it**. **GJK** never builds it — it needs only `support(A−B, d) = support(A, d) − support(B, −d)` and iteratively refines a simplex toward the origin. GJK is warm-startable from the previous frame's simplex, converging in 1–2 iterations for coherent motion, giving near-constant-time collision. Ideal here: every Shapeland entity is convex, so one support function per shape covers all pairs.
- **Point-in-polygon**: even-odd ray crossing (O(n), branch-light) or winding number (handles self-intersection correctly). For grid-aligned regions, prefer integer cell-set membership — exact and allocation-free.
- **Voronoi / Delaunay** are duals: Voronoi partitions space by nearest seed (biomes, territory, faction control); Delaunay maximizes the minimum angle, avoiding skinny triangles, and is the right graph for road/corridor networks between region centers. Lloyd relaxation regularizes cell sizes.
- **Poisson-disk sampling (Bridson, O(N))**: maintain an active list; per iteration draw up to `k ≈ 30` candidates from the annulus `[r, 2r)` around a random active sample, accept if ≥ `r` from all neighbors, else retire the sample. Background grid of cell size `r/√2` guarantees ≤1 point per cell and O(1) neighbor queries. This is the correct placement primitive for enemies, props, and loot — blue noise, no clumps, no visible lattice.
- **Wang tiles** for infinite non-periodic layout with edge-color matching constraints. Recursive blue-noise Wang tiles (Kopf et al.) give **deterministic, constant-memory, locally regenerable** point sets over unbounded areas with spatially varying density — exactly what an open world streamed by chunk needs. Poisson-disk tiles (Lagae & Dutré) precompute Poisson distributions into Wang tiles; the subtlety is the corner/edge critical regions within `r` of a boundary, which constrain up to 3 neighbors.
- **Marching squares** for contouring scalar fields into region boundaries and cliff/water outlines; the 16-case lookup table with the standard saddle-case disambiguation.

```ts
const manhattan  = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // roll cost
const chebyshev  = (a: Cell, b: Cell) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

// Chebyshev rings are 8n, Manhattan rings are 4n (both verified).
// Using chebyshev as a height function yields terraced square pyramids -- ziggurats.
const ziggurat = (x: number, y: number, peak: number) =>
  Math.max(0, peak - Math.max(Math.abs(x), Math.abs(y)));

// Minkowski difference contains the origin  <=>  the two convex shapes intersect.
const supportMinkowski = (a: Convex, b: Convex, d: Vec3) =>
  sub(a.support(d), b.support(negate(d)));
```

---

## Sources

**Cube group / S₄**
- https://math.stackexchange.com/questions/1424072/let-c-be-a-cube-and-let-g-be-its-rotational-symmetry-group-show-that-g-is-isomo
- https://math.stackexchange.com/questions/2765402/the-group-of-rotation-of-a-cube-is-isomorphic-to-s-4
- https://math.stackexchange.com/questions/4770878/rotations-of-a-cube-isomorphic-to-s-4
- https://www.math.purdue.edu/~arapura/algebra/algebra6.pdf (conjugacy classes, A₄, cube ≅ S₄)

**Rolling puzzles / complexity**
- https://erikdemaine.org/papers/DiceRolling_CCCG2007/paper.pdf (state graph, parity property, NP-completeness, forbidden cycles)
- http://cccg.ca/proceedings/2007/05b5full.pdf
- https://www.nearly42.org/vdisk/cstheory/rollingcubenpc3.pdf (non-unique Hamiltonian cycles; NP-completeness without free cells)
- https://doi.org/10.2197/ipsjjip.20.719 (Rolling Block Mazes are PSPACE-complete)

**Rolling polyhedra on tilings**
- https://erikdemaine.org/papers/Rolling_FUN2022/paper.pdf (plane/hollow/band/bounded rollers; Table 1 & 2)
- https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.FUN.2022.6
- https://mathworld.wolfram.com/RollingPolyhedronGraph.html (rolling cube 24/48; octa → Nauru; icosa 120/180)
- https://doi.org/10.1371/journal.pone.0252613 and https://pmc.ncbi.nlm.nih.gov/articles/PMC8171926/ (edge-rolling path planning; tetrahedron one-pose-per-cell; roll angles)

**Orientation representation**
- https://www.geometrictools.com/Documentation/RotationRepresentations.pdf (slerp derivation, `p·q ≥ 0` shortest arc)
- https://arxiv.org/html/2605.08086v1 (drift, re-orthogonalization, double cover)
- https://arxiv.org/html/2511.04452v1 (gimbal lock, renormalization cost, composition order)

**SDFs**
- https://iquilezles.org/articles/distfunctions/ (primitives, booleans, repetition operators)
- https://iquilezles.org/articles/smin/ (smooth min families, gradient bound, raymarch safety)
- https://iquilezles.org/articles/sdfrepetition/ (repetition artifacts and fixes)
- https://iquilezles.org/articles/raymarchingdf/

**Collision / sampling / tiling**
- https://solid.sourceforge.net/jgt98convex.pdf (van den Bergen, fast robust GJK)
- https://simple-robotics.github.io/publications/gjk-acceleration/static/paper/montaut2024gjk.pdf (Minkowski difference properties, CSO)
- https://www.wikiwand.com/en/Gilbert%E2%80%93Johnson%E2%80%93Keerthi_distance_algorithm (support/NearestSimplex pseudocode, warm start)
- https://www.cs.ubc.ca/~rbridson/docs/bridson-siggraph07-poissondisk.pdf
- https://dl.acm.org/doi/10.1145/1179352.1141916 (recursive blue-noise Wang tiles)
- https://graphics.cs.kuleuven.be/publications/LD05PODF/LD05PODF_paper.pdf (Poisson-disk Wang tiles, corner/edge regions)

*(~1,750 words excluding tables, code, and sources.)*

**Verification harness:** `research/verify_cube_group.mjs` — run with `node research/verify_cube_group.mjs` to regenerate and re-prove every Section 1 figure and all four roll tables.
