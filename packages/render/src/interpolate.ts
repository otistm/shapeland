import type { SimSnapshot } from "@shapeland/sim";
import { type CameraTarget, cameraTarget, nlerp, visualPose } from "./pose";

export interface InterpolatedPlayer {
  x: number;
  y: number;
  z: number;
  orientation: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export interface InterpolatedFrame {
  alpha: number;
  tick: number;
  player: InterpolatedPlayer;
  camera: CameraTarget;
}

/** Snapshots are read-only. Visual pose is derived; the camera uses linear progress. */
export function interpolate(prev: SimSnapshot, cur: SimSnapshot, alpha: number): InterpolatedFrame {
  const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const a = visualPose(prev);
  const b = visualPose(cur);
  const ca = cameraTarget(prev);
  const cb = cameraTarget(cur);
  const q = nlerp(a.quat, b.quat, t);
  return {
    alpha: t,
    tick: cur.tick,
    player: {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      orientation: cur.player.orientation,
      qx: q.x,
      qy: q.y,
      qz: q.z,
      qw: q.w,
    },
    camera: {
      followX: ca.followX + (cb.followX - ca.followX) * t,
      followZ: ca.followZ + (cb.followZ - ca.followZ) * t,
      restY: ca.restY + (cb.restY - ca.restY) * t,
    },
  };
}
