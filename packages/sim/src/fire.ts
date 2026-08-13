import {
  DT,
  FIRE_BASE_RATE,
  FIRE_BUOY,
  FIRE_DRAG,
  FIRE_ENTRAIN,
  FIRE_MAX,
  FIRE_MAX_AGE,
  FIRE_NECK_AMT,
  FIRE_NECK_H,
  FIRE_NECK_W,
  FIRE_PUFF_HZ,
  FIRE_PUFF_N,
  FIRE_R0,
  FIRE_RAD_K,
  FIRE_SWIRL0,
  FIRE_SWIRL_TAU,
  FIRE_TAU,
  FIRE_V0,
} from "./constants";
import { lickStretch, particleFade } from "./fire-ramp";
import { type Sfc32State, sfc32Next } from "./rng";

function u01(rng: Sfc32State): number {
  return sfc32Next(rng) / 4294967296;
}

/** Marsaglia disc → unit XZ. Fallback after a handful of rejects so spawn is bounded. */
function unitXZ(rng: Sfc32State): { x: number; z: number } {
  for (let n = 0; n < 8; n++) {
    const u = u01(rng) * 2 - 1;
    const v = u01(rng) * 2 - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) {
      const inv = 1 / Math.sqrt(s);
      return { x: u * inv, z: v * inv };
    }
  }
  return { x: 1, z: 0 };
}

/** Lorentzian stand-in for a Gaussian neck. Sim may not call unspecified exp. */
function gaussApprox(x: number): number {
  const x2 = x * x;
  return 1 / (1 + x2 + x2 * x2 * 0.5);
}

/**
 * CPU plume oracle. Preallocated SoA, swap-remove, cap 340.
 * Gameplay reads count / temperature; render copies the live slots.
 */
export class FireField {
  count = 0;
  baseAcc = 0;
  puffPhase = 0;
  swirlSign = 1;
  readonly x = new Float32Array(FIRE_MAX);
  readonly y = new Float32Array(FIRE_MAX);
  readonly z = new Float32Array(FIRE_MAX);
  readonly ax = new Float32Array(FIRE_MAX);
  readonly az = new Float32Array(FIRE_MAX);
  readonly y0 = new Float32Array(FIRE_MAX);
  readonly r0 = new Float32Array(FIRE_MAX);
  readonly vy = new Float32Array(FIRE_MAX);
  readonly swirl = new Float32Array(FIRE_MAX);
  readonly T = new Float32Array(FIRE_MAX);
  readonly age = new Float32Array(FIRE_MAX);
  readonly size = new Float32Array(FIRE_MAX);
  readonly scale = new Float32Array(FIRE_MAX);
  readonly stretch = new Float32Array(FIRE_MAX);
  readonly fade = new Float32Array(FIRE_MAX);
  readonly seed = new Float32Array(FIRE_MAX);

  spawn(ax: number, az: number, y: number, scale: number, rng: Sfc32State): void {
    if (this.count >= FIRE_MAX) return;
    const i = this.count;
    this.count = i + 1;
    const dir = unitXZ(rng);
    const r0 = FIRE_R0 * scale * (0.6 + u01(rng) * 0.5);
    this.ax[i] = ax;
    this.az[i] = az;
    this.y0[i] = y;
    this.x[i] = ax + dir.x * r0 * 0.35;
    this.y[i] = y;
    this.z[i] = az + dir.z * r0 * 0.35;
    this.r0[i] = r0;
    this.vy[i] = FIRE_V0 * (0.7 + u01(rng) * 0.6);
    this.T[i] = 1;
    this.age[i] = 0;
    this.swirl[i] = this.swirlSign * FIRE_SWIRL0 * (0.6 + u01(rng) * 0.8);
    this.size[i] = (0.34 + u01(rng) * 0.22) * scale;
    this.scale[i] = scale;
    this.stretch[i] = 1;
    this.fade[i] = 1;
    this.seed[i] = u01(rng) * 10;
  }

  private kill(i: number): void {
    const last = this.count - 1;
    this.count = last;
    if (i === last) return;
    this.x[i] = this.x[last] ?? 0;
    this.y[i] = this.y[last] ?? 0;
    this.z[i] = this.z[last] ?? 0;
    this.ax[i] = this.ax[last] ?? 0;
    this.az[i] = this.az[last] ?? 0;
    this.y0[i] = this.y0[last] ?? 0;
    this.r0[i] = this.r0[last] ?? 0;
    this.vy[i] = this.vy[last] ?? 0;
    this.swirl[i] = this.swirl[last] ?? 0;
    this.T[i] = this.T[last] ?? 0;
    this.age[i] = this.age[last] ?? 0;
    this.size[i] = this.size[last] ?? 0;
    this.scale[i] = this.scale[last] ?? 0;
    this.stretch[i] = this.stretch[last] ?? 0;
    this.fade[i] = this.fade[last] ?? 0;
    this.seed[i] = this.seed[last] ?? 0;
  }

  step(bi: number, baseY: number, ax: number, az: number, rng: Sfc32State): void {
    if (bi > 0.05) {
      this.baseAcc += DT * FIRE_BASE_RATE * bi;
      while (this.baseAcc >= 1 && this.count < FIRE_MAX) {
        this.baseAcc -= 1;
        this.spawn(ax, az, baseY + 0.5, 1, rng);
      }
      this.puffPhase += DT * FIRE_PUFF_HZ;
      if (this.puffPhase >= 1) {
        this.puffPhase -= 1;
        this.swirlSign = -this.swirlSign;
        const n = (FIRE_PUFF_N * bi + 0.5) | 0;
        for (let p = 0; p < n; p++) this.spawn(ax, az, baseY + 0.45, 1, rng);
      }
    }

    let i = 0;
    while (i < this.count) {
      const T = (this.T[i] ?? 0) - (this.T[i] ?? 0) * (DT / FIRE_TAU);
      this.T[i] = T;
      this.age[i] = (this.age[i] ?? 0) + DT;
      if (T < 0.05 || (this.age[i] ?? 0) > FIRE_MAX_AGE) {
        this.kill(i);
        continue;
      }

      const prevX = this.x[i] ?? 0;
      const prevY = this.y[i] ?? 0;
      const prevZ = this.z[i] ?? 0;
      let vy = this.vy[i] ?? 0;
      vy += FIRE_BUOY * T * DT;
      vy -= FIRE_DRAG * vy * DT;
      this.vy[i] = vy;

      const y0 = this.y0[i] ?? 0;
      const hh = prevY - y0 < 0 ? 0 : prevY - y0;
      const neck = 1 - FIRE_NECK_AMT * gaussApprox((hh - FIRE_NECK_H) / FIRE_NECK_W);
      const targetR =
        (this.r0[i] ?? 0) * neck + FIRE_ENTRAIN * (hh - FIRE_NECK_H < 0 ? 0 : hh - FIRE_NECK_H);
      const originX = this.ax[i] ?? ax;
      const originZ = this.az[i] ?? az;
      let px = prevX;
      let pz = prevZ;
      const dx = px - originX;
      const dz = pz - originZ;
      const r = Math.sqrt(dx * dx + dz * dz);
      if (r > 1e-6) {
        const k = ((targetR - r) * (DT * FIRE_RAD_K < 1 ? DT * FIRE_RAD_K : 1)) / r;
        px += dx * k;
        pz += dz * k;
      }
      let swirl = this.swirl[i] ?? 0;
      const rx = px - originX;
      const rz = pz - originZ;
      px += -rz * swirl * DT;
      pz += rx * swirl * DT;
      swirl -= swirl * (DT / FIRE_SWIRL_TAU);
      this.swirl[i] = swirl;
      const py = prevY + vy * DT;
      this.x[i] = px;
      this.y[i] = py;
      this.z[i] = pz;

      const invDt = 1 / DT;
      const spd = Math.sqrt(
        (px - prevX) * (px - prevX) * invDt * invDt +
          (py - prevY) * (py - prevY) * invDt * invDt +
          (pz - prevZ) * (pz - prevZ) * invDt * invDt,
      );
      this.stretch[i] = lickStretch(spd);
      this.size[i] = (this.size[i] ?? 0) + DT * 0.3 * (this.scale[i] ?? 1);
      this.fade[i] = particleFade(T, this.age[i] ?? 0, bi, FIRE_MAX_AGE);
      i += 1;
    }
  }

  meanHeight(): number {
    if (this.count === 0) return 0;
    let s = 0;
    for (let i = 0; i < this.count; i++) s += this.y[i] ?? 0;
    return s / this.count;
  }

  meanT(): number {
    if (this.count === 0) return 0;
    let s = 0;
    for (let i = 0; i < this.count; i++) s += this.T[i] ?? 0;
    return s / this.count;
  }
}
