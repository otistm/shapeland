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
}

function expSmooth(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
}

/**
 * Extra camera Y so a column between the cube and the rig does not hide the player.
 * Samples integer cells on the +Z look vector using resting heights only — never the eased cube.
 */
export function occlusionLift(
  heightAt: (x: number, z: number) => number,
  followX: number,
  followZ: number,
  restY: number,
): number {
  const dz = CAM_OFFSET[2];
  if (dz <= 0) return 0;
  const camY = restY + CAM_OFFSET[1];
  const aimY = restY + CAM_AIM;
  const ix = followX < 0 ? -Math.round(-followX) : Math.round(followX);
  const i0 = (followZ < 0 ? Math.ceil(followZ) : Math.floor(followZ)) + 1;
  const i1 = Math.floor(followZ + dz);
  let lift = 0;
  for (let iz = i0; iz <= i1; iz++) {
    const t = (iz - followZ) / dz;
    if (t <= 0 || t >= 1) continue;
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

export function cameraYawDeg(): number {
  return (Math.atan2(CAM_OFFSET[0], CAM_OFFSET[2]) * 180) / Math.PI;
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
  };
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

  const wantX = rig.target.x + CAM_OFFSET[0];
  let wantY = rig.target.y + CAM_OFFSET[1];
  const wantZ = rig.target.z + CAM_OFFSET[2];
  if (input.heightAt) {
    const lift = occlusionLift(input.heightAt, input.followX, input.followZ, input.restY);
    rig.occludeY += (lift - rig.occludeY) * expSmooth(CAM_FOLLOW, input.dt);
    wantY += rig.occludeY;
  }

  if (!ready.current) {
    rig.position.x = wantX;
    rig.position.y = wantY;
    rig.position.z = wantZ;
    ready.current = true;
    return;
  }

  const k = expSmooth(CAM_FOLLOW, input.dt);
  rig.position.x += (wantX - rig.position.x) * k;
  rig.position.y += (wantY - rig.position.y) * k;
  rig.position.z += (wantZ - rig.position.z) * k;

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
