import {
  CAM_AIM,
  CAM_CLIMB,
  CAM_FOLLOW,
  CAM_KICK_DAMP,
  CAM_KICK_STIFF,
  CAM_LOOKAHEAD,
  CAM_LOOKAHEAD_RATE,
  CAM_OFFSET,
  CAM_SHAKE_DECAY,
  CAM_YAW_RATE,
  SHAKE_FLOOR,
  SHAKE_MIN,
} from "@shapeland/sim";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraRig {
  position: Vec3;
  target: Vec3;
  lookAheadX: number;
  lookAheadZ: number;
  kickY: number;
  kickV: number;
  shake: number;
  /** Extra camera Y to clear a column on the look vector. Resting heights only. */
  occludeY: number;
  /** Integer quarter-turns 0..3. Stick mapping uses this, never `yawVisual`. */
  yaw: number;
  /** Continuous quarter-turns chasing `yaw`. Render orbit only. */
  yawVisual: number;
  yawCos: number;
  yawSin: number;
}

export interface CameraInput {
  /** Linear roll progress on the lattice — never the eased cube. */
  followX: number;
  followZ: number;
  /** Resting ground height, not the cube's arc or jump. */
  restY: number;
  /** Cardinal aim of the current roll/leap, or 0. */
  aimX?: number;
  aimZ?: number;
  dt: number;
  /** Resting terrain height at integer cells. Used to lift over occluding columns. */
  heightAt?: (x: number, z: number) => number;
  /** Reduced motion snaps the orbit; default eases at `CAM_YAW_RATE`. */
  reduced?: boolean;
}

function expSmooth(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

function wrapYaw(yaw: number): number {
  return yaw & 3;
}

/** Right-hand Y rotation of an XZ pair by `yaw` quarter-turns. No trig, no alloc. */
export function yawRotateX(x: number, z: number, yaw: number): number {
  const q = wrapYaw(yaw);
  if (q === 0) return x;
  if (q === 1) return -z;
  if (q === 2) return -x;
  return z;
}

export function yawRotateZ(x: number, z: number, yaw: number): number {
  const q = wrapYaw(yaw);
  if (q === 0) return z;
  if (q === 1) return x;
  if (q === 2) return -z;
  return -x;
}

export function cameraOffsetForYaw(yaw: number): readonly [number, number, number] {
  return [
    yawRotateX(CAM_OFFSET[0], CAM_OFFSET[2], yaw),
    CAM_OFFSET[1],
    yawRotateZ(CAM_OFFSET[0], CAM_OFFSET[2], yaw),
  ];
}

/** Shortest unwrapped quarter so two left taps orbit 180° the same way, not the other short arc. */
export function unwrapQuarter(visual: number, target: number): number {
  let t = target;
  while (t - visual > 2) t -= 4;
  while (visual - t > 2) t += 4;
  return t;
}

const YAW_SNAP = 1e-4;

function writeVisualBasis(rig: CameraRig): void {
  const visual = rig.yawVisual;
  const nearest = visual < 0 ? -Math.round(-visual) : Math.round(visual);
  if (visual - nearest < YAW_SNAP && nearest - visual < YAW_SNAP) {
    const q = wrapYaw(nearest);
    rig.yawCos = q === 0 ? 1 : q === 2 ? -1 : 0;
    rig.yawSin = q === 1 ? 1 : q === 3 ? -1 : 0;
    return;
  }
  const rad = visual * (Math.PI / 2);
  rig.yawCos = Math.cos(rad);
  rig.yawSin = Math.sin(rad);
}

function visualOffsetX(rig: CameraRig): number {
  return CAM_OFFSET[0] * rig.yawCos - CAM_OFFSET[2] * rig.yawSin;
}

function visualOffsetZ(rig: CameraRig): number {
  return CAM_OFFSET[0] * rig.yawSin + CAM_OFFSET[2] * rig.yawCos;
}

function roundCoord(v: number): number {
  return v < 0 ? -Math.round(-v) : Math.round(v);
}

function occlusionAlong(
  heightAtCell: (i: number) => number,
  followAlong: number,
  dAlong: number,
  restY: number,
): number {
  if (dAlong === 0) return 0;
  const camY = restY + CAM_OFFSET[1];
  const aimY = restY + CAM_AIM;
  let lift = 0;
  if (dAlong > 0) {
    const i0 = (followAlong < 0 ? Math.ceil(followAlong) : Math.floor(followAlong)) + 1;
    const i1 = Math.floor(followAlong + dAlong);
    for (let i = i0; i <= i1; i++) {
      const t = (i - followAlong) / dAlong;
      if (t <= 0 || t >= 1) continue;
      const rayY = aimY + (camY - aimY) * t;
      const need = heightAtCell(i) + 0.85 - rayY;
      if (need > lift) lift = need;
    }
  } else {
    const i0 = (followAlong > 0 ? Math.floor(followAlong) : Math.ceil(followAlong)) - 1;
    const i1 = Math.ceil(followAlong + dAlong);
    for (let i = i0; i >= i1; i--) {
      const t = (i - followAlong) / dAlong;
      if (t <= 0 || t >= 1) continue;
      const rayY = aimY + (camY - aimY) * t;
      const need = heightAtCell(i) + 0.85 - rayY;
      if (need > lift) lift = need;
    }
  }
  return lift;
}

/**
 * Extra camera Y so a column between the cube and the rig does not hide the player.
 * Samples integer cells on the look vector (camera-relative +Z at yaw 0) using
 * resting heights only — never the eased cube.
 */
export function occlusionLift(
  heightAt: (x: number, z: number) => number,
  followX: number,
  followZ: number,
  restY: number,
  yaw = 0,
): number {
  const ox = yawRotateX(CAM_OFFSET[0], CAM_OFFSET[2], yaw);
  const oz = yawRotateZ(CAM_OFFSET[0], CAM_OFFSET[2], yaw);
  const ax = ox < 0 ? -ox : ox;
  const az = oz < 0 ? -oz : oz;
  if (ax >= az) {
    if (ax <= 0) return 0;
    const iz = roundCoord(followZ);
    return occlusionAlong((ix) => heightAt(ix, iz), followX, ox, restY);
  }
  if (az <= 0) return 0;
  const ix = roundCoord(followX);
  return occlusionAlong((iz) => heightAt(ix, iz), followZ, oz, restY);
}

function occlusionLiftOffset(
  heightAt: (x: number, z: number) => number,
  followX: number,
  followZ: number,
  restY: number,
  ox: number,
  oz: number,
): number {
  const ax = ox < 0 ? -ox : ox;
  const az = oz < 0 ? -oz : oz;
  if (az * 32 < ax) {
    if (ax <= 0) return 0;
    const iz = roundCoord(followZ);
    return occlusionAlong((ix) => heightAt(ix, iz), followX, ox, restY);
  }
  if (ax * 32 < az) {
    if (az <= 0) return 0;
    const ix = roundCoord(followX);
    return occlusionAlong((iz) => heightAt(ix, iz), followZ, oz, restY);
  }
  const camY = restY + CAM_OFFSET[1];
  const aimY = restY + CAM_AIM;
  const n = Math.ceil(ax > az ? ax : az);
  let lift = 0;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const ix = roundCoord(followX + ox * t);
    const iz = roundCoord(followZ + oz * t);
    const rayY = aimY + (camY - aimY) * t;
    const need = heightAt(ix, iz) + 0.85 - rayY;
    if (need > lift) lift = need;
  }
  return lift;
}

export function cameraOffsetLength(): number {
  const x = CAM_OFFSET[0];
  const y = CAM_OFFSET[1];
  const z = CAM_OFFSET[2];
  return Math.sqrt(x * x + y * y + z * z);
}

export function cameraYawDeg(yaw = 0): number {
  const ox = yawRotateX(CAM_OFFSET[0], CAM_OFFSET[2], yaw);
  const oz = yawRotateZ(CAM_OFFSET[0], CAM_OFFSET[2], yaw);
  return (Math.atan2(ox, oz) * 180) / Math.PI;
}

export function cameraPitchDeg(): number {
  const h = Math.hypot(CAM_OFFSET[0], CAM_OFFSET[2]);
  return (Math.atan2(CAM_OFFSET[1], h) * 180) / Math.PI;
}

export function createCameraRig(): CameraRig {
  return {
    position: { x: CAM_OFFSET[0], y: CAM_OFFSET[1], z: CAM_OFFSET[2] },
    target: { x: 0, y: 0, z: 0 },
    lookAheadX: 0,
    lookAheadZ: 0,
    kickY: 0,
    kickV: 0,
    shake: 0,
    occludeY: 0,
    yaw: 0,
    yawVisual: 0,
    yawCos: 1,
    yawSin: 0,
  };
}

/** Resting yaw steps one lattice quarter. Visual orbit chases in `stepCamera`. */
export function turnCameraYaw(rig: CameraRig, delta: 1 | -1): void {
  rig.yaw = wrapYaw(rig.yaw + delta);
}

/**
 * Follows linear ground motion and resting height. Traversal never writes shake.
 * Impact shake is a separate entry point labelled `// impact:`.
 */
export function stepCamera(rig: CameraRig, input: CameraInput, ready: { current: boolean }): void {
  const aimX = input.aimX ?? 0;
  const aimZ = input.aimZ ?? 0;
  const lookK = expSmooth(CAM_LOOKAHEAD_RATE, input.dt);
  rig.lookAheadX += (aimX * CAM_LOOKAHEAD - rig.lookAheadX) * lookK;
  rig.lookAheadZ += (aimZ * CAM_LOOKAHEAD - rig.lookAheadZ) * lookK;

  const groundY = rig.target.y + (input.restY - rig.target.y) * expSmooth(CAM_CLIMB, input.dt);
  rig.target.x = input.followX + rig.lookAheadX;
  rig.target.y = groundY;
  rig.target.z = input.followZ + rig.lookAheadZ;

  const yawTarget = unwrapQuarter(rig.yawVisual, rig.yaw);
  if (input.reduced || !ready.current) {
    rig.yawVisual = rig.yaw;
  } else {
    rig.yawVisual += (yawTarget - rig.yawVisual) * expSmooth(CAM_YAW_RATE, input.dt);
    const d = yawTarget - rig.yawVisual;
    if (d < YAW_SNAP && -d < YAW_SNAP) rig.yawVisual = rig.yaw;
  }
  writeVisualBasis(rig);
  const ox = visualOffsetX(rig);
  const oz = visualOffsetZ(rig);
  const wantX = rig.target.x + ox;
  let wantY = rig.target.y + CAM_OFFSET[1];
  const wantZ = rig.target.z + oz;
  if (input.heightAt) {
    const lift = occlusionLiftOffset(
      input.heightAt,
      input.followX,
      input.followZ,
      input.restY,
      ox,
      oz,
    );
    rig.occludeY += (lift - rig.occludeY) * expSmooth(CAM_FOLLOW, input.dt);
    wantY += rig.occludeY;
  }

  if (!ready.current || input.reduced) {
    rig.position.x = wantX;
    rig.position.y = wantY;
    rig.position.z = wantZ;
    ready.current = true;
    if (!input.reduced) return;
  } else {
    const k = expSmooth(CAM_FOLLOW, input.dt);
    rig.position.x += (wantX - rig.position.x) * k;
    rig.position.y += (wantY - rig.position.y) * k;
    rig.position.z += (wantZ - rig.position.z) * k;
  }

  rig.kickV += (-CAM_KICK_STIFF * rig.kickY - CAM_KICK_DAMP * rig.kickV) * input.dt;
  rig.kickY += rig.kickV * input.dt;

  if (rig.shake > 0) {
    rig.shake *= Math.exp(-CAM_SHAKE_DECAY * input.dt);
    if (rig.shake < SHAKE_FLOOR) rig.shake = 0;
  }
}

export function lookAtY(rig: CameraRig): number {
  return rig.target.y + CAM_AIM;
}

/** impact: only called from hit feedback. Traversal must never call this. */
export function impactShake(rig: CameraRig, amount: number): void {
  if (amount < SHAKE_MIN) return;
  rig.shake = amount;
}

/** One kick-spring exciter: a physical landing drops the camera, then it recovers. */
export function impactKick(rig: CameraRig, impulse: number): void {
  rig.kickV -= impulse;
}

export function clearCameraFeel(rig: CameraRig): void {
  rig.shake = 0;
  rig.kickY = 0;
  rig.kickV = 0;
  rig.occludeY = 0;
}
