import {
  DIR_DX,
  DIR_DZ,
  FLIGHT_TICKS,
  LEAP_CELLS,
  MODE_AIR,
  MODE_CROUCH,
  MODE_FALL,
  MODE_ROLL,
  MODE_TUCK,
  ROLL_LIFT,
  ROLL_LIFT_STEP,
  type SimSnapshot,
  TUCK_LIFT,
} from "@shapeland/sim";
import { type Quat, orientationQuaternion } from "./orientation-map";

export interface Pose {
  x: number;
  y: number;
  z: number;
  quat: Quat;
}

export interface CameraTarget {
  followX: number;
  followZ: number;
  restY: number;
}

export function rollEase(t: number): number {
  return t * t * (2.2 - 1.2 * t);
}

function smoothstep01(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function clamp01(t: number): number {
  if (t < 0) return 0;
  if (t > 1) return 1;
  return t;
}

function axisAngle(ax: number, ay: number, az: number, ang: number): Quat {
  const h = ang * 0.5;
  const s = Math.sin(h);
  return { x: ax * s, y: ay * s, z: az * s, w: Math.cos(h) };
}

function qmul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function rollAxis(dir: number): [number, number, number] {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  return [dz, 0, -dx];
}

function progress(phase: number, duration: number): number {
  if (duration <= 0) return 1;
  return clamp01(phase / duration);
}

/** Linear lattice progress and resting ground — never the eased cube. */
export function cameraTarget(s: SimSnapshot): CameraTarget {
  const m = s.move;
  if (m.mode === MODE_ROLL) {
    const t = progress(m.phase, m.duration);
    return {
      followX: m.startX + (m.destX - m.startX) * t,
      followZ: m.startZ + (m.destZ - m.startZ) * t,
      restY: m.destY,
    };
  }
  if (m.mode === MODE_AIR && m.leap === 1) {
    const t = clamp01(m.phase / FLIGHT_TICKS);
    return {
      followX: m.startX + (m.destX - m.startX) * t,
      followZ: m.startZ + (m.destZ - m.startZ) * t,
      restY: m.destY,
    };
  }
  if (m.mode === MODE_AIR || m.mode === MODE_CROUCH || m.mode === MODE_FALL) {
    return { followX: m.startX, followZ: m.startZ, restY: m.destY };
  }
  return { followX: s.player.x, followZ: s.player.z, restY: s.player.y };
}

function restPose(x: number, h: number, z: number, ori: number): Pose {
  return {
    x,
    y: h + 0.5,
    z,
    quat: orientationQuaternion(ori),
  };
}

export function visualPose(s: SimSnapshot): Pose {
  const m = s.move;
  if (m.mode === MODE_ROLL) {
    const k = progress(m.phase, m.duration);
    const e = rollEase(k);
    const lift = ROLL_LIFT + ROLL_LIFT_STEP * Math.max(0, m.destY - m.startY);
    const [ax, ay, az] = rollAxis(m.dir);
    const q0 = orientationQuaternion(m.startOri);
    const qSpin = axisAngle(ax, ay, az, e * (Math.PI / 2));
    return {
      x: m.startX + (m.destX - m.startX) * e,
      y: m.startY + 0.5 + (m.destY - m.startY) * e + lift * Math.sin(e * Math.PI),
      z: m.startZ + (m.destZ - m.startZ) * e,
      quat: qmul(qSpin, q0),
    };
  }
  if (m.mode === MODE_TUCK) {
    const p = progress(m.phase, m.duration);
    const rp = smoothstep01((p - 0.12) / 0.76);
    const [ax, ay, az] = rollAxis(m.dir);
    const q0 = orientationQuaternion(m.startOri);
    const qSpin = axisAngle(ax, ay, az, rp * (Math.PI / 2));
    return {
      x: m.startX,
      y: m.startY + 0.5 + Math.sin(p * Math.PI) * TUCK_LIFT,
      z: m.startZ,
      quat: qmul(qSpin, q0),
    };
  }
  if (m.mode === MODE_AIR) {
    const y = m.airY;
    if (m.leap === 1) {
      const p = clamp01(m.phase / FLIGHT_TICKS);
      const rp = clamp01((p - 0.08) / 0.8);
      const [ax, ay, az] = rollAxis(m.dir);
      const q0 = orientationQuaternion(m.startOri);
      const qSpin = axisAngle(ax, ay, az, smoothstep01(rp) * (Math.PI / 2) * LEAP_CELLS);
      return {
        x: m.startX + (m.destX - m.startX) * p,
        y,
        z: m.startZ + (m.destZ - m.startZ) * p,
        quat: qmul(qSpin, q0),
      };
    }
    return restPose(m.startX, y - 0.5, m.startZ, m.startOri);
  }
  if (m.mode === MODE_FALL) {
    return restPose(s.player.x, m.airY - 0.5, s.player.z, s.player.orientation);
  }
  return restPose(s.player.x, s.player.y, s.player.z, s.player.orientation);
}

export function nlerp(a: Quat, b: Quat, t: number): Quat {
  let bx = b.x;
  let by = b.y;
  let bz = b.z;
  let bw = b.w;
  if (a.x * bx + a.y * by + a.z * bz + a.w * bw < 0) {
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  const x = a.x + (bx - a.x) * t;
  const y = a.y + (by - a.y) * t;
  const z = a.z + (bz - a.z) * t;
  const w = a.w + (bw - a.w) * t;
  const inv = 1 / Math.sqrt(x * x + y * y + z * z + w * w);
  return { x: x * inv, y: y * inv, z: z * inv, w: w * inv };
}
