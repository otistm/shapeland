/**
 * Generate and prove the cube rotation group using the canonical 4u+s indexing.
 * This is the TypeScript promotion of tools/verify-cube-group.mjs.
 */

import {
  DIRS,
  DOWN,
  PARITY,
  ROLL_E,
  ROLL_N,
  ROLL_S,
  ROLL_W,
  UP,
  YAW,
  cellParity,
} from "./orientation";

type Mat = number[];

function mul(A: Mat, B: Mat): Mat {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] =
        (A[i * 3] ?? 0) * (B[j] ?? 0) +
        (A[i * 3 + 1] ?? 0) * (B[3 + j] ?? 0) +
        (A[i * 3 + 2] ?? 0) * (B[6 + j] ?? 0);
    }
  }
  return out;
}

const det = (M: Mat): number =>
  (M[0] ?? 0) * ((M[4] ?? 0) * (M[8] ?? 0) - (M[5] ?? 0) * (M[7] ?? 0)) -
  (M[1] ?? 0) * ((M[3] ?? 0) * (M[8] ?? 0) - (M[5] ?? 0) * (M[6] ?? 0)) +
  (M[2] ?? 0) * ((M[3] ?? 0) * (M[7] ?? 0) - (M[4] ?? 0) * (M[6] ?? 0));

const key = (M: Mat): string => M.join(",");

const apply = (M: Mat, v: readonly number[]): [number, number, number] => [
  (M[0] ?? 0) * (v[0] ?? 0) + (M[1] ?? 0) * (v[1] ?? 0) + (M[2] ?? 0) * (v[2] ?? 0),
  (M[3] ?? 0) * (v[0] ?? 0) + (M[4] ?? 0) * (v[1] ?? 0) + (M[5] ?? 0) * (v[2] ?? 0),
  (M[6] ?? 0) * (v[0] ?? 0) + (M[7] ?? 0) * (v[1] ?? 0) + (M[8] ?? 0) * (v[2] ?? 0),
];

const I: Mat = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const Rx90: Mat = [1, 0, 0, 0, 0, -1, 0, 1, 0];
const Rx270: Mat = [1, 0, 0, 0, 0, 1, 0, -1, 0];
const Rx180: Mat = [1, 0, 0, 0, -1, 0, 0, 0, -1];
const Ry90: Mat = [0, 0, 1, 0, 1, 0, -1, 0, 0];
const Ry270: Mat = [0, 0, -1, 0, 1, 0, 1, 0, 0];
const Rz90: Mat = [0, -1, 0, 1, 0, 0, 0, 0, 1];

const FACEREF: Mat[] = [I, Rx180, Ry270, Ry90, Rx90, Rx270];

const DIAG = [
  [1, 1, 1],
  [1, 1, -1],
  [1, -1, 1],
  [1, -1, -1],
] as const;

const canon = (v: readonly number[]): string => {
  const x = v[0] ?? 0;
  const y = v[1] ?? 0;
  const flipped = x < 0 || (x === 0 && y < 0) ? v.map((n) => -n) : v;
  return flipped.join(",");
};

const dKey = new Map(DIAG.map((d, i) => [canon(d), i]));

function permOfDiagonals(M: Mat): number[] {
  return DIAG.map((d) => {
    const k = dKey.get(canon(apply(M, d)));
    if (k === undefined) throw new Error("diagonal not found");
    return k;
  });
}

function sgn(p: readonly number[]): number {
  let s = 1;
  for (let i = 0; i < p.length; i++) {
    for (let j = i + 1; j < p.length; j++) {
      if ((p[i] ?? 0) > (p[j] ?? 0)) s = -s;
    }
  }
  return s;
}

const FACE_DIR: readonly (readonly number[])[] = [
  [0, 0, 1],
  [0, 0, -1],
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
];

function upFaceOf(M: Mat): number {
  for (let f = 0; f < 6; f++) {
    const dir = FACE_DIR[f];
    if (!dir) continue;
    const w = apply(M, dir);
    if (w[2] === 1) return f;
  }
  throw new Error("no up face");
}

function pow(M: Mat, n: number): Mat {
  let r = I;
  for (let i = 0; i < n; i++) r = mul(M, r);
  return r;
}

function buildOrientationMatrices(): Mat[] {
  const ORI: Mat[] = [];
  for (let u = 0; u < 6; u++) {
    const ref = FACEREF[u];
    if (!ref) throw new Error("missing FACEREF");
    for (let s = 0; s < 4; s++) {
      ORI.push(mul(pow(Rz90, s), ref));
    }
  }
  return ORI;
}

let cachedOri: Mat[] | undefined;

/** Body→world rotation in Z-up sim space. Length 9, row-major. */
export function orientationMatrices(): readonly number[][] {
  cachedOri ??= buildOrientationMatrices();
  return cachedOri;
}

export function orientationMatrix(i: number): readonly number[] {
  const M = orientationMatrices()[i];
  if (!M) throw new Error(`orientation out of range: ${i}`);
  return M;
}

export interface ProofLine {
  ok: boolean;
  message: string;
}

export function proveCubeGroup(): ProofLine[] {
  const lines: ProofLine[] = [];
  const log = (ok: boolean, message: string) => {
    lines.push({ ok, message });
  };

  const ORI = orientationMatrices();

  const index = new Map(ORI.map((M, i) => [key(M), i]));
  log(
    ORI.length === 24 && index.size === 24,
    `|rotation group| = ${ORI.length} distinct ${index.size}`,
  );

  let closed = true;
  for (const A of ORI) {
    for (const B of ORI) {
      if (!index.has(key(mul(A, B)))) closed = false;
    }
  }
  log(closed, `closed under composition: ${closed}`);
  log(index.get(key(I)) === 0, `identity at index ${index.get(key(I))}`);

  const detAll = ORI.every((M) => det(M) === 1);
  log(detAll, `every matrix has det +1: ${detAll}`);

  const diagPerms = ORI.map(permOfDiagonals);
  const distinct = new Set(diagPerms.map((p) => p.join(",")));
  log(distinct.size === 24, `injective hom to S4: ${distinct.size} distinct diagonal perms`);
  const even = diagPerms.filter((p) => sgn(p) === 1).length;
  log(even === 12, `even (A4) count ${even}, odd ${24 - even}`);

  const generatedParity = diagPerms.map((p) => sgn(p));
  const parityMatch = generatedParity.every((p, i) => p === (PARITY[i] ?? 0));
  log(parityMatch, `generated diagonal parity matches PARITY table: ${parityMatch}`);

  const lookup = (M: Mat): number => {
    const i = index.get(key(M));
    if (i === undefined) throw new Error(`matrix not in group: ${key(M)}`);
    return i;
  };

  const genE = ORI.map((R) => lookup(mul(Ry90, R)));
  const genW = ORI.map((R) => lookup(mul(Ry270, R)));
  const genN = ORI.map((R) => lookup(mul(Rx270, R)));
  const genS = ORI.map((R) => lookup(mul(Rx90, R)));

  const same = (a: readonly number[], b: readonly number[]) => a.every((v, i) => v === b[i]);
  log(same(genE, ROLL_E), "generated ROLL_E matches table");
  log(same(genW, ROLL_W), "generated ROLL_W matches table");
  log(same(genN, ROLL_N), "generated ROLL_N matches table");
  log(same(genS, ROLL_S), "generated ROLL_S matches table");

  const tableAt = (table: readonly number[], i: number): number | undefined => table[i];
  const involE = ORI.every((_, i) => {
    const e = tableAt(ROLL_E, i);
    return e !== undefined && tableAt(ROLL_W, e) === i;
  });
  const involN = ORI.every((_, i) => {
    const n = tableAt(ROLL_N, i);
    return n !== undefined && tableAt(ROLL_S, n) === i;
  });
  log(involE, `ROLL_W ∘ ROLL_E = id: ${involE}`);
  log(involN, `ROLL_S ∘ ROLL_N = id: ${involN}`);

  const flips = ORI.every((_, i) =>
    [ROLL_E, ROLL_W, ROLL_N, ROLL_S].every((t) => {
      const next = tableAt(t, i);
      return next !== undefined && tableAt(PARITY, next) === -(tableAt(PARITY, i) ?? 0);
    }),
  );
  log(flips, `every roll flips parity: ${flips}`);

  const ups = ORI.every((M, i) => upFaceOf(M) === UP(i));
  log(ups, `upFace(i) === i >> 2: ${ups}`);
  const downs = ORI.every((_, i) => DOWN(i) === (UP(i) ^ 1));
  log(downs, `downFace(i) === upFace(i) ^ 1: ${downs}`);
  const yaws = ORI.every((_, i) => lookup(mul(Rz90, ORI[i] ?? I)) === YAW(i));
  log(yaws, `yaw is arithmetic: ${yaws}`);

  const R = 9;
  const seen = new Map<string, number>();
  seen.set("0,0,0", 0);
  let frontier: Array<[number, number, number]> = [[0, 0, 0]];
  const steps = [DIRS.E, DIRS.W, DIRS.N, DIRS.S];
  while (frontier.length) {
    const next: Array<[number, number, number]> = [];
    for (const [x, z, o] of frontier) {
      for (const step of steps) {
        const nx = x + step.dx;
        const nz = z + step.dz;
        if (Math.abs(nx) > R || Math.abs(nz) > R) continue;
        const no = step.roll[o];
        if (no === undefined) continue;
        const s = `${nx},${nz},${no}`;
        if (!seen.has(s)) {
          seen.set(s, (seen.get(`${x},${z},${o}`) ?? 0) + 1);
          next.push([nx, nz, no]);
        }
      }
    }
    frontier = next;
  }

  const perCell = new Map<string, Set<number>>();
  for (const s of seen.keys()) {
    const parts = s.split(",").map(Number);
    const x = parts[0] ?? 0;
    const z = parts[1] ?? 0;
    const o = parts[2] ?? 0;
    const c = `${x},${z}`;
    let set = perCell.get(c);
    if (!set) {
      set = new Set();
      perCell.set(c, set);
    }
    set.add(o);
  }
  const sizes = new Set([...perCell.values()].map((set) => set.size));
  const cells = (2 * R + 1) ** 2;
  log(
    perCell.size === cells && sizes.size === 1 && sizes.has(12),
    `BFS 19×19: ${perCell.size}/${cells} cells, orientation-counts ${[...sizes]}`,
  );

  let parityHolds = true;
  for (const s of seen.keys()) {
    const parts = s.split(",").map(Number);
    const x = parts[0] ?? 0;
    const z = parts[1] ?? 0;
    const o = parts[2] ?? 0;
    if (cellParity(x, z) !== (PARITY[o] ?? 0)) parityHolds = false;
  }
  log(parityHolds, `parity law PARITY[o] === (−1)^(x+z) on every reached state: ${parityHolds}`);

  const atOrigin = [...(perCell.get("0,0") ?? [])];
  const originSet = new Set(atOrigin);
  let subgroup = true;
  for (const a of atOrigin) {
    for (const b of atOrigin) {
      const A = ORI[a];
      const B = ORI[b];
      if (!A || !B || !originSet.has(lookup(mul(A, B)))) subgroup = false;
    }
  }
  log(
    atOrigin.length === 12 && subgroup,
    `orientations at origin ${atOrigin.length}, closed (A4): ${subgroup}`,
  );
  const originEven = atOrigin.every((o) => sgn(diagPerms[o] ?? []) === 1);
  log(originEven, `origin orientations are even: ${originEven}`);

  const yawParity = sgn(permOfDiagonals(Rz90));
  log(yawParity === -1, `in-place yaw Rz(90) parity ${yawParity} (odd)`);
  const yawOrbit = new Set(atOrigin.flatMap((o) => [o, lookup(mul(Rz90, ORI[o] ?? I))]));
  log(yawOrbit.size === 24, `|A4 ∪ yaw·A4| = ${yawOrbit.size}`);

  const returns = [...seen.entries()].filter(([s]) => s.startsWith("0,0,")).map(([, d]) => d);
  const maxReturn = Math.max(...returns);
  log(maxReturn === 6, `max rolls to return to start cell with a given orientation: ${maxReturn}`);

  return lines;
}

export function assertCubeGroup(): void {
  const failed = proveCubeGroup().filter((line) => !line.ok);
  if (failed.length) {
    throw new Error(failed.map((line) => line.message).join("\n"));
  }
}
