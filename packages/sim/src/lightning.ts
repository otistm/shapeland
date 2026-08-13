import {
  BOLT_BRANCH_LEVELS,
  BOLT_DISP,
  BOLT_LEVELS,
  BOLT_MAX_BRANCHES,
  BOLT_MIN_BRANCHES,
  BOLT_POINTS,
  BOLT_TOP,
  SPREAD_DUR,
  SPREAD_R,
} from "./constants";
import { type Sfc32State, seedSfc32, sfc32Next } from "./rng";

function u01(rng: Sfc32State): number {
  return sfc32Next(rng) / 4294967296;
}

function write(buf: Float32Array, i: number, x: number, y: number, z: number): void {
  const o = i * 3;
  buf[o] = x;
  buf[o + 1] = y;
  buf[o + 2] = z;
}

function read(buf: Float32Array, i: number): { x: number; y: number; z: number } {
  const o = i * 3;
  return { x: buf[o] ?? 0, y: buf[o + 1] ?? 0, z: buf[o + 2] ?? 0 };
}

/** Perpendicular in XZ (cross with +Y). No sin/cos. */
function displaceXZ(
  dx: number,
  dz: number,
  mag: number,
  rng: Sfc32State,
): { x: number; z: number } {
  let px = dz;
  let pz = -dx;
  const len2 = px * px + pz * pz;
  if (len2 < 1e-12) {
    px = 1;
    pz = 0;
  } else {
    const inv = 1 / Math.sqrt(len2);
    px *= inv;
    pz *= inv;
  }
  const amp = mag * (u01(rng) * 0.9 + 0.1);
  const sign = (sfc32Next(rng) & 1) === 0 ? -1 : 1;
  return { x: px * amp * sign, z: pz * amp * sign };
}

/**
 * Midpoint displacement into `out`. Starts with 2 points, `levels` halvings.
 * 5 levels → 33 points. Returns the live count.
 */
export function midpointDisplace(
  out: Float32Array,
  scratch: Float32Array,
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  disp: number,
  levels: number,
  rng: Sfc32State,
): number {
  write(out, 0, ax, ay, az);
  write(out, 1, bx, by, bz);
  let count = 2;
  let mag = disp;
  for (let level = 0; level < levels; level++) {
    let n = 0;
    write(scratch, 0, out[0] ?? 0, out[1] ?? 0, out[2] ?? 0);
    n = 1;
    for (let i = 0; i < count - 1; i++) {
      const p0 = read(out, i);
      const p1 = read(out, i + 1);
      const mx = (p0.x + p1.x) * 0.5;
      const my = (p0.y + p1.y) * 0.5;
      const mz = (p0.z + p1.z) * 0.5;
      const d = displaceXZ(p1.x - p0.x, p1.z - p0.z, mag, rng);
      write(scratch, n, mx + d.x, my, mz + d.z);
      n += 1;
      write(scratch, n, p1.x, p1.y, p1.z);
      n += 1;
    }
    for (let i = 0; i < n * 3; i++) out[i] = scratch[i] ?? 0;
    count = n;
    mag *= 0.5;
  }
  return count;
}

export interface BoltGeom {
  main: Float32Array;
  mainCount: number;
  branches: Float32Array[];
  branchCount: number;
  branchLen: Int32Array;
}

export function createBoltGeom(): BoltGeom {
  const branches: Float32Array[] = [];
  for (let i = 0; i < BOLT_MAX_BRANCHES; i++) {
    branches.push(new Float32Array(BOLT_POINTS * 3));
  }
  return {
    main: new Float32Array(BOLT_POINTS * 3),
    mainCount: 0,
    branches,
    branchCount: 0,
    branchLen: new Int32Array(BOLT_MAX_BRANCHES),
  };
}

function pinDescending(
  buf: Float32Array,
  count: number,
  groundY: number,
  hitX: number,
  hitZ: number,
): void {
  for (let i = 1; i < count; i++) {
    const prevY = buf[(i - 1) * 3 + 1] ?? 0;
    const y = buf[i * 3 + 1] ?? 0;
    if (y > prevY) buf[i * 3 + 1] = prevY;
    if ((buf[i * 3 + 1] ?? 0) < groundY) buf[i * 3 + 1] = groundY;
  }
  const last = count - 1;
  write(buf, last, hitX, groundY, hitZ);
}

/** Seeded channel: sky 11 → ground, strike pinned, 3–5 diving branches. */
export function generateBolt(
  seed: number,
  x: number,
  z: number,
  groundY: number,
  out: BoltGeom = createBoltGeom(),
): BoltGeom {
  const rng = seedSfc32(seed, "bolt");
  const scratch = new Float32Array(BOLT_POINTS * 3);
  const topX = x + (u01(rng) - 0.5) * 2.2;
  const topZ = z + (u01(rng) - 0.5) * 2.2;
  out.mainCount = midpointDisplace(
    out.main,
    scratch,
    topX,
    BOLT_TOP,
    topZ,
    x,
    groundY,
    z,
    BOLT_DISP,
    BOLT_LEVELS,
    rng,
  );
  pinDescending(out.main, out.mainCount, groundY, x, z);

  const nB = BOLT_MIN_BRANCHES + (sfc32Next(rng) % (BOLT_MAX_BRANCHES - BOLT_MIN_BRANCHES + 1));
  out.branchCount = nB;
  for (let b = 0; b < nB; b++) {
    const buf = out.branches[b];
    if (!buf) continue;
    const span = out.mainCount * 0.6;
    const i = 2 + (sfc32Next(rng) % Math.max(1, span | 0));
    const from = read(out.main, i < out.mainCount - 3 ? i : out.mainCount - 3);
    const dir = unitPerp(rng);
    const len = 1.4 + u01(rng) * 2.2;
    let ty = from.y - len;
    if (ty < groundY + 0.1) ty = groundY + 0.1;
    const count = midpointDisplace(
      buf,
      scratch,
      from.x,
      from.y,
      from.z,
      from.x + dir.x * len * 0.7,
      ty,
      from.z + dir.z * len * 0.7,
      0.8,
      BOLT_BRANCH_LEVELS,
      rng,
    );
    out.branchLen[b] = count;
  }
  return out;
}

function unitPerp(rng: Sfc32State): { x: number; z: number } {
  return displaceXZ(1, 0, 1, rng);
}

export function boltAlong(y: number, groundY: number): number {
  const span = BOLT_TOP - groundY;
  if (span <= 0) return 1;
  const t = (BOLT_TOP - y) / span;
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

/** Decelerating front: 0 at t=0, SPREAD_R at t=SPREAD_DUR. Ease-out quad (1−(1−k)²). */
export function spreadFront(t: number): number {
  const k = t / SPREAD_DUR;
  const u = k < 0 ? 0 : k > 1 ? 1 : k;
  return SPREAD_R * (1 - (1 - u) * (1 - u));
}

/**
 * Zap speed from a non-compounding reference. Each heading snap reads `vRef`,
 * which decays only by drag — never from the previous sampled velocity.
 */
export function zapSpeed(vRef0: number, drag: number, t: number): number {
  const k = 1 - drag * t;
  return vRef0 * (k < 0 ? 0 : k);
}
