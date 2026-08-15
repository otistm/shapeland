import { SQUASH_DAMP, SQUASH_STIFF, TURRET_RANGE2, TURRET_STATE_COOL } from "@shapeland/sim";

/** Same spring as cube squash. Offset is visual; occupancy chases on the lattice. */
export interface Lunge {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** Stop on the cube's face, not inside its volume. */
const CONTACT = 0.55;
const LIFT = 5;

export function createLunge(): Lunge {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 };
}

function stepAxis(pos: number, vel: number, target: number, dt: number): { p: number; v: number } {
  const acc = -SQUASH_STIFF * (pos - target) - SQUASH_DAMP * vel;
  const v = vel + acc * dt;
  const p = pos + v * dt;
  return { p, v };
}

function seekLen(len: number, range2: number): number {
  const max = range2 > 0 ? Math.sqrt(range2) : 0;
  const want = len > CONTACT ? len - CONTACT : 0;
  if (want <= max) return want;
  return max;
}

/**
 * Hunt the live cube for as long as it stays inside `range2`. Leaving the radius is what
 * releases the spring — there is no snap back to a rest pose while the cube is in reach.
 */
export function stepLunge(
  s: Lunge,
  restX: number,
  restY: number,
  restZ: number,
  cubeX: number,
  cubeY: number,
  cubeZ: number,
  state: number,
  t: number,
  _aimTicks: number,
  blast: boolean,
  dt: number,
  reduced: boolean,
  range2: number = TURRET_RANGE2,
  persist = true,
): void {
  const dx = cubeX - restX;
  const dy = cubeY - restY;
  const dz = cubeZ - restZ;
  const d2 = dx * dx + dz * dz;
  const inRange = d2 <= range2;
  const hunting = persist ? inRange : inRange && state === TURRET_STATE_COOL && t < 18;
  const len = Math.hypot(dx, dy, dz);
  const inv = len > 0.0001 ? 1 / len : 0;
  const ux = dx * inv;
  const uy = dy * inv;
  const uz = dz * inv;
  const reach = hunting ? seekLen(len, range2) : 0;
  const tx = ux * reach;
  const ty = hunting ? uy * reach * 0.35 + 0.06 : 0;
  const tz = uz * reach;
  if (reduced) {
    s.x = tx;
    s.y = ty;
    s.z = tz;
    s.vx = 0;
    s.vy = 0;
    s.vz = 0;
    return;
  }
  if (blast && hunting) {
    const slam = 10 + reach * 2.4;
    s.vx += ux * slam;
    s.vy += LIFT;
    s.vz += uz * slam;
  }
  const x = stepAxis(s.x, s.vx, tx, dt);
  const y = stepAxis(s.y, s.vy, ty, dt);
  const z = stepAxis(s.z, s.vz, tz, dt);
  const cap = (hunting ? reach : 0) + 0.85;
  const lim = cap < 1 ? 1 : cap;
  const clamp = (p: number, max: number) => (p < -max ? -max : p > max ? max : p);
  s.x = clamp(x.p, lim);
  s.y = y.p < -0.5 ? -0.5 : y.p > 2.2 ? 2.2 : y.p;
  s.z = clamp(z.p, lim);
  s.vx = x.v;
  s.vy = y.v;
  s.vz = z.v;
}

/** Rise, overshoot, retract. Integer cool-tick in, so reduced motion can pop to 1. */
export function spikeRise(t: number, spikeTicks: number, reduced: boolean): number {
  if (t <= 0 || t > spikeTicks) return 0;
  if (reduced) return 1;
  if (t <= 5) return (t / 5) * 1.22;
  if (t <= 11) return 1.22 - (t - 5) * 0.03;
  const span = spikeTicks - 11;
  if (span <= 0) return 0;
  const k = 1 - (t - 11) / span;
  return k < 0 ? 0 : k;
}
