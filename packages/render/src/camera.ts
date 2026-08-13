import { CAM_AIM, CAM_CLIMB, CAM_FOLLOW, CAM_OFFSET, SHAKE_FLOOR } from "@shapeland/sim";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraRig {
  position: Vec3;
  target: Vec3;
  shake: number;
}

export interface CameraInput {
  /** Linear roll progress on the lattice — never the eased cube. */
  followX: number;
  followZ: number;
  /** Resting ground height, not the cube's arc or jump. */
  restY: number;
  dt: number;
}

function expSmooth(lambda: number, dt: number): number {
  return 1 - Math.exp(-lambda * dt);
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
    shake: 0,
  };
}

/**
 * Follows linear ground motion and resting height. Traversal never writes shake.
 * Impact shake is a separate entry point labelled `// impact:`.
 */
export function stepCamera(rig: CameraRig, input: CameraInput, ready: { current: boolean }): void {
  const groundY = rig.target.y + (input.restY - rig.target.y) * expSmooth(CAM_CLIMB, input.dt);
  rig.target.x = input.followX;
  rig.target.y = groundY;
  rig.target.z = input.followZ;

  const wantX = rig.target.x + CAM_OFFSET[0];
  const wantY = rig.target.y + CAM_OFFSET[1];
  const wantZ = rig.target.z + CAM_OFFSET[2];

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

  if (rig.shake > 0) {
    rig.shake *= Math.exp(-7.5 * input.dt);
    if (rig.shake < SHAKE_FLOOR) rig.shake = 0;
  }
}

export function lookAtY(rig: CameraRig): number {
  return rig.target.y + CAM_AIM;
}

/** impact: only called from hit feedback. Traversal must never call this. */
export function impactShake(rig: CameraRig, amount: number): void {
  if (amount < 0.05) return;
  rig.shake = amount;
}
