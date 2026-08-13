import {
  FLAG_LAND,
  FLAG_LAND_DOWN,
  FLAG_LAUNCH,
  FLAG_REFUSE,
  MODE_AIR,
  MODE_CROUCH,
  MODE_ROLL,
  MODE_TUCK,
  SQUASH_DAMP,
  SQUASH_STIFF,
} from "@shapeland/sim";

export interface Squash {
  y: number;
  vel: number;
  target: number;
}

export function createSquash(): Squash {
  return { y: 1, vel: 0, target: 1 };
}

export function stepSquash(
  s: Squash,
  mode: number,
  phase: number,
  flags: number,
  vy: number,
  dt: number,
): { sy: number; sxz: number } {
  if (mode === MODE_CROUCH) s.target = 0.7;
  else if (mode === MODE_ROLL) {
    if (phase === 1) s.target = 0.93;
    else if (phase > 5) s.target = 1;
  } else if (mode === MODE_TUCK) {
    if (phase === 1) s.target = 0.84;
    else if (phase > 8) s.target = 1;
  } else s.target = 1;

  if ((flags & FLAG_REFUSE) !== 0) s.vel -= 2.2;
  if ((flags & FLAG_LAND) !== 0) s.vel -= 3.4;
  if ((flags & FLAG_LAND_DOWN) !== 0) s.vel -= 3.2;
  if ((flags & FLAG_LAUNCH) !== 0) s.vel += 9.5;

  const acc = -SQUASH_STIFF * (s.y - s.target) - SQUASH_DAMP * s.vel;
  s.vel += acc * dt;
  s.y += s.vel * dt;
  if (s.y < 0.45) s.y = 0.45;
  if (s.y > 1.55) s.y = 1.55;

  let sy = s.y;
  if (mode === MODE_AIR) {
    const stretch = vy * 0.035;
    const k = stretch < -0.18 ? -0.18 : stretch > 0.26 ? 0.26 : stretch;
    sy *= 1 + k;
  }
  const sxz = 1 / Math.sqrt(sy < 0.2 ? 0.2 : sy);
  return { sy, sxz };
}
