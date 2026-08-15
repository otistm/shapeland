import { FLAG_HURT, INTEGRITY, I_FRAMES_TICKS, MODE_IDLE, RESPAWN_IFRAMES } from "./constants";

export interface HurtHost {
  x: number;
  h: number;
  z: number;
  orientation: number;
  mode: number;
  flags: number;
  integrity: number;
  spawnX: number;
  spawnH: number;
  spawnZ: number;
  spawnOri: number;
  vy: number;
  airY: number;
  jumpBuf: number;
  pivotArmed: number;
  moveLock: number;
  iframes: number;
}

function snapIdle(w: HurtHost, x: number, h: number, z: number, ori: number): void {
  w.x = x;
  w.h = h;
  w.z = z;
  w.orientation = ori;
  w.mode = MODE_IDLE;
  w.vy = 0;
  w.airY = h + 0.5;
}

export function respawnAtAnchor(w: HurtHost): void {
  snapIdle(w, w.spawnX, w.spawnH, w.spawnZ, w.spawnOri);
  w.jumpBuf = 0;
  w.pivotArmed = 0;
  w.moveLock = 0;
  w.integrity = INTEGRITY;
  w.iframes = RESPAWN_IFRAMES;
}

export function hurt(w: HurtHost): void {
  if (w.iframes > 0) return;
  w.integrity -= 1;
  w.iframes = I_FRAMES_TICKS;
  w.flags |= FLAG_HURT;
  if (w.integrity <= 0) respawnAtAnchor(w);
}
