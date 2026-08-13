// Verification of cube-rotation-group claims for the Shapeland research brief.
// Orientation = 3x3 integer matrix R (body -> world), columns are +-e_i, det = +1.

const mul = (A, B) =>
  A.map((_, i) => [0, 1, 2].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j] + A[i][2] * B[2][j]));
const det = (M) =>
  M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
  M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
  M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
const key = (M) => M.flat().join(",");
const apply = (M, v) => [0, 1, 2].map((i) => M[i][0] * v[0] + M[i][1] * v[1] + M[i][2] * v[2]);

// ---- 1. Enumerate all 24 -------------------------------------------------
const perms = [];
(function p(rest, acc) {
  if (!rest.length) return perms.push(acc);
  rest.forEach((r, i) =>
    p(
      rest.filter((_, k) => k !== i),
      [...acc, r],
    ),
  );
})([0, 1, 2], []);

const ORI = [];
for (const perm of perms)
  for (let s = 0; s < 8; s++) {
    const M = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];
    // column j of M is the image of body axis j = +-e_{perm[j]}
    for (let j = 0; j < 3; j++) M[perm[j]][j] = (s >> j) & 1 ? -1 : 1;
    if (det(M) === 1) ORI.push(M);
  }
const idx = new Map(ORI.map((M, i) => [key(M), i]));
console.log("1. |rotation group| =", ORI.length, "(all det +1, distinct:", idx.size, ")");

// closure under multiplication => it is a group
let closed = true;
for (const A of ORI) for (const B of ORI) if (!idx.has(key(mul(A, B)))) closed = false;
console.log("   closed under composition (is a group):", closed);

// index 0 must be identity
const ID = ORI.findIndex((M) => key(M) === "1,0,0,0,1,0,0,0,1");
console.log("   identity at index:", ID);

// ---- 2. Isomorphism to S4 via the four body diagonals -------------------
const DIAG = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
];
const canon = (v) => (v[0] < 0 || (v[0] === 0 && v[1] < 0) ? v.map((x) => -x) : v).join(",");
const dKey = new Map(DIAG.map((d, i) => [canon(d), i]));
const permOfDiagonals = (M) => DIAG.map((d) => dKey.get(canon(apply(M, d))));
const sgn = (p) => {
  let s = 1;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) if (p[i] > p[j]) s = -s;
  return s;
};
const diagPerms = ORI.map(permOfDiagonals);
const distinct = new Set(diagPerms.map((p) => p.join("")));
console.log(
  "2. distinct diagonal permutations =",
  distinct.size,
  "=> injective hom to S4 =>  G ~ S4:",
  distinct.size === 24,
);
console.log(
  "   even (A4) count:",
  diagPerms.filter((p) => sgn(p) === 1).length,
  " odd count:",
  diagPerms.filter((p) => sgn(p) === -1).length,
);

// ---- 3. Roll generators (world-space quarter turns about horizontal axes) -
// Rolling toward +X carries world up (0,0,1) -> (1,0,0): that is Ry(+90).
const Ry90 = [
  [0, 0, 1],
  [0, 1, 0],
  [-1, 0, 0],
]; // toward +X
const Ry270 = [
  [0, 0, -1],
  [0, 1, 0],
  [1, 0, 0],
]; // toward -X
const Rx270 = [
  [1, 0, 0],
  [0, 0, 1],
  [0, -1, 0],
]; // toward +Y
const Rx90 = [
  [1, 0, 0],
  [0, 0, -1],
  [0, 1, 0],
]; // toward -Y
const DIRS = [
  { name: "+X", d: [1, 0], W: Ry90 },
  { name: "-X", d: [-1, 0], W: Ry270 },
  { name: "+Y", d: [0, 1], W: Rx270 },
  { name: "-Y", d: [0, -1], W: Rx90 },
];
for (const D of DIRS) {
  const up = apply(D.W, [0, 0, 1]);
  console.log(
    `3. roll ${D.name}: world-up -> ${up}  det=${det(D.W)}  diag-perm parity=${sgn(permOfDiagonals(D.W))}`,
  );
}

// transition table  ROLL[dir][orientationIndex] -> orientationIndex
const ROLL = DIRS.map((D) => ORI.map((R) => idx.get(key(mul(D.W, R)))));
console.log(
  "   every roll is a 4-cycle on diagonals (odd permutation):",
  DIRS.every((D) => sgn(permOfDiagonals(D.W)) === -1),
);

// involutions: rolling +X then -X returns to start
console.log(
  "   roll(+X) then roll(-X) == identity for all 24:",
  ORI.every((_, i) => ROLL[1][ROLL[0][i]] === i),
);

// ---- 4. Up-face extraction and the opposite involution ------------------
// body faces 0..5 = +X,-X,+Y,-Y,+Z,-Z ; opposite(f) = f ^ 1
const FACEDIR = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
const upFace = (i) => {
  const M = ORI[i];
  // body face f is up when M * dir(f) == +Z
  for (let f = 0; f < 6; f++) {
    const w = apply(M, FACEDIR[f]);
    if (w[2] === 1) return f;
  }
  throw new Error("no up face");
};
const downFace = (i) => {
  const M = ORI[i];
  for (let f = 0; f < 6; f++) if (apply(M, FACEDIR[f])[2] === -1) return f;
};
const counts = {};
ORI.forEach((_, i) => (counts[upFace(i)] = (counts[upFace(i)] || 0) + 1));
console.log("4. orientations per up-face:", counts, "(each should be 4)");
console.log(
  "   up(i) and down(i) are always opposite (f ^ 1):",
  ORI.every((_, i) => downFace(i) === (upFace(i) ^ 1)),
);
// standard die: opposite faces sum to 7 if pips are p(f) with p(f)+p(f^1)=7
const PIPS = [3, 4, 2, 5, 1, 6]; // +X,-X,+Y,-Y,+Z,-Z  (right-handed die, 1 up / 2 north-ish)
console.log(
  "   pip involution p(f)+p(f^1)==7 for all f:",
  [0, 2, 4].every((f) => PIPS[f] + PIPS[f ^ 1] === 7),
);

// ---- 5. BFS over (cell x orientation): the parity theorem ---------------
const R = 9; // half-width of test board
const seen = new Map(); // "x,y,ori" -> steps
const start = [0, 0, ID];
seen.set("0,0," + ID, 0);
let frontier = [start];
while (frontier.length) {
  const next = [];
  for (const [x, y, o] of frontier)
    for (let k = 0; k < 4; k++) {
      const nx = x + DIRS[k].d[0],
        ny = y + DIRS[k].d[1];
      if (Math.abs(nx) > R || Math.abs(ny) > R) continue;
      const no = ROLL[k][o];
      const s = `${nx},${ny},${no}`;
      if (!seen.has(s)) {
        seen.set(s, seen.get(`${x},${y},${o}`) + 1);
        next.push([nx, ny, no]);
      }
    }
  frontier = next;
}
const perCell = new Map();
for (const s of seen.keys()) {
  const [x, y, o] = s.split(",").map(Number);
  const c = `${x},${y}`;
  if (!perCell.has(c)) perCell.set(c, new Set());
  perCell.get(c).add(o);
}
const sizes = new Set([...perCell.values()].map((s) => s.size));
console.log(
  "5. cells reached:",
  perCell.size,
  "of",
  (2 * R + 1) ** 2,
  "| distinct orientation-counts per cell:",
  [...sizes],
);

// parity law: sgn(diagonal perm) == (-1)^(x+y)
let parityHolds = true;
for (const s of seen.keys()) {
  const [x, y, o] = s.split(",").map(Number);
  const expect = (x + y) % 2 === 0 ? 1 : -1;
  if (sgn(diagPerms[o]) !== expect) parityHolds = false;
}
console.log(
  "   parity law  sgn(sigma_o) == (-1)^(x+y)  holds on every reached state:",
  parityHolds,
);

// the 12 orientations at the origin form a subgroup isomorphic to A4
const atOrigin = [...perCell.get("0,0")];
const originSet = new Set(atOrigin);
let subgroup = true;
for (const a of atOrigin)
  for (const b of atOrigin) if (!originSet.has(idx.get(key(mul(ORI[a], ORI[b]))))) subgroup = false;
console.log(
  "   orientations at origin:",
  atOrigin.length,
  "| closed under composition (a subgroup):",
  subgroup,
);
console.log(
  "   all of them are EVEN permutations (=> the subgroup is A4):",
  atOrigin.every((o) => sgn(diagPerms[o]) === 1),
);
const upsAtOrigin = new Set(atOrigin.map(upFace));
console.log(
  "   distinct up-faces available at a fixed cell:",
  upsAtOrigin.size,
  "(of 6) => 6 faces x 2 of 4 spins",
);

// an in-place 90-degree yaw is odd => it restores the other coset
const Rz90 = [
  [0, -1, 0],
  [1, 0, 0],
  [0, 0, 1],
];
console.log(
  "   in-place yaw Rz(90) parity:",
  sgn(permOfDiagonals(Rz90)),
  "(odd => flips coset, restores all 24)",
);
const yawOrbit = new Set(atOrigin.flatMap((o) => [o, idx.get(key(mul(Rz90, ORI[o])))]));
console.log("   |A4 orbit union yaw*A4| =", yawOrbit.size);

// ---- 6. Quotient rolling graph (ignore position) ------------------------
const edges = new Set();
ORI.forEach((_, i) =>
  DIRS.forEach((_, k) => edges.add([i, ROLL[k][i]].sort((a, b) => a - b).join("-"))),
);
console.log(
  "6. rolling-cube graph: vertices =",
  ORI.length,
  " undirected edges =",
  edges.size,
  "(4-regular)",
);
// bipartite check
console.log(
  "   bipartite by permutation parity:",
  ORI.every((_, i) => DIRS.every((_, k) => sgn(diagPerms[ROLL[k][i]]) === -sgn(diagPerms[i]))),
);

// diameter of the fixed-cell holonomy: min rolls to return to origin with each of the 12
const returns = [...seen.entries()].filter(([s]) => s.startsWith("0,0,")).map(([s, d]) => d);
console.log(
  "   min rolls to return to start cell with a given orientation: max =",
  Math.max(...returns),
);

// ---- 7. Chebyshev vs Manhattan rings -----------------------------------
const ring = (n, metric) => {
  let c = 0;
  for (let x = -n; x <= n; x++)
    for (let y = -n; y <= n; y++) {
      const d = metric === "cheb" ? Math.max(Math.abs(x), Math.abs(y)) : Math.abs(x) + Math.abs(y);
      if (d === n) c++;
    }
  return c;
};
console.log(
  "7. Chebyshev ring sizes n=0..4:",
  [0, 1, 2, 3, 4].map((n) => ring(n, "cheb")),
  "(8n)",
);
console.log(
  "   Manhattan ring sizes n=0..4:",
  [0, 1, 2, 3, 4].map((n) => ring(n, "man")),
  "(4n)",
);
