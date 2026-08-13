import {
  BUTTON_JUMP,
  BUTTON_PIVOT,
  CROUCH_TICKS,
  DIR_DX,
  DIR_DZ,
  DIR_NONE,
  DT,
  FALL_GRAV_MUL,
  FALL_KILL_Y,
  FLAG_AIR_LAND,
  FLAG_FALL_KILL,
  FLAG_LAND,
  FLAG_LAND_DOWN,
  FLAG_LAUNCH,
  FLAG_PIVOT,
  FLAG_REFUSE,
  GRAV,
  HANG,
  HANG_AT,
  JUMP_BUFFER_TICKS,
  JUMP_V0,
  LEAP_CELLS,
  MODE_AIR,
  MODE_CROUCH,
  MODE_FALL,
  MODE_IDLE,
  MODE_ROLL,
  MODE_SLIDE,
  MODE_TUCK,
  ROLL_TICKS,
  SLIDE_CELL_TICKS,
  TUCK_TICKS,
} from "./constants";
import { dirFromMask } from "./input";
import { iceHas, slideEnd } from "./ice";
import { rollTowardDir } from "./orientation";
import type { Terrain } from "./terrain";

export interface Mover {
  x: number;
  h: number;
  z: number;
  orientation: number;
  mode: number;
  dir: number;
  phase: number;
  duration: number;
  startX: number;
  startH: number;
  startZ: number;
  startOri: number;
  destX: number;
  destH: number;
  destZ: number;
  destOri: number;
  leap: number;
  jumpBuf: number;
  pivotArmed: number;
  moveLock: number;
  flags: number;
  vy: number;
  airY: number;
  prevMask: number;
  spawnX: number;
  spawnH: number;
  spawnZ: number;
  spawnOri: number;
  terrain: Terrain;
  occupied(x: number, z: number): boolean;
  ice: Uint32Array;
  iceCount: number;
}

export function canRollTo(terrain: Terrain, x: number, z: number, tx: number, tz: number): boolean {
  if (terrain.isWall(tx, tz) || terrain.isGap(tx, tz)) return false;
  const dh = terrain.height(tx, tz) - terrain.height(x, z);
  return dh <= 1 && dh >= -1;
}

export function canLeapDir(terrain: Terrain, x: number, z: number, dir: number): boolean {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  const mx = x + dx;
  const mz = z + dz;
  const ex = x + dx * LEAP_CELLS;
  const ez = z + dz * LEAP_CELLS;
  const h0 = terrain.height(x, z);
  if (terrain.isWall(mx, mz) || terrain.isWall(ex, ez)) return false;
  if (terrain.height(mx, mz) > h0 + 1 || terrain.height(ex, ez) > h0 + 1) return false;
  return true;
}

/** Geometric leap: two cells and two rolls. Occupancy is not consulted. */
export function leapPose(
  x: number,
  z: number,
  ori: number,
  dir: number,
): {
  x: number;
  z: number;
  ori: number;
} {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  return {
    x: x + dx * LEAP_CELLS,
    z: z + dz * LEAP_CELLS,
    ori: rollTowardDir(rollTowardDir(ori, dir), dir),
  };
}

export function twoRollPose(
  x: number,
  z: number,
  ori: number,
  dir: number,
): {
  x: number;
  z: number;
  ori: number;
} {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  const o1 = rollTowardDir(ori, dir);
  return {
    x: x + dx + dx,
    z: z + dz + dz,
    ori: rollTowardDir(o1, dir),
  };
}

function rising(mask: number, prev: number, bit: number): boolean {
  return (mask & bit) !== 0 && (prev & bit) === 0;
}

function snapIdle(w: Mover, x: number, h: number, z: number, ori: number): void {
  w.x = x;
  w.h = h;
  w.z = z;
  w.orientation = ori;
  w.mode = MODE_IDLE;
  w.dir = DIR_NONE;
  w.phase = 0;
  w.duration = 0;
  w.leap = 0;
  w.vy = 0;
  w.airY = 0;
}

function beginMove(
  w: Mover,
  mode: number,
  dir: number,
  duration: number,
  destX: number,
  destH: number,
  destZ: number,
  destOri: number,
): void {
  w.mode = mode;
  w.dir = dir;
  w.phase = 0;
  w.duration = duration;
  w.startX = w.x;
  w.startH = w.h;
  w.startZ = w.z;
  w.startOri = w.orientation;
  w.destX = destX;
  w.destH = destH;
  w.destZ = destZ;
  w.destOri = destOri;
}

function tryMove(w: Mover, dir: number): void {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  const tx = w.x + dx;
  const tz = w.z + dz;
  if (canRollTo(w.terrain, w.x, w.z, tx, tz) && !w.occupied(tx, tz)) {
    const nextOri = rollTowardDir(w.orientation, dir);
    beginMove(w, MODE_ROLL, dir, ROLL_TICKS, tx, w.terrain.height(tx, tz), tz, nextOri);
    return;
  }
  w.flags |= FLAG_REFUSE;
}

function startTuck(w: Mover, dir: number): void {
  beginMove(w, MODE_TUCK, dir, TUCK_TICKS, w.x, w.h, w.z, rollTowardDir(w.orientation, dir));
  w.flags |= FLAG_PIVOT;
}

function tryJump(w: Mover): void {
  if (w.mode !== MODE_IDLE) {
    if (w.mode === MODE_ROLL || w.mode === MODE_AIR || w.mode === MODE_SLIDE) w.jumpBuf = JUMP_BUFFER_TICKS;
    return;
  }
  beginMove(w, MODE_CROUCH, DIR_NONE, CROUCH_TICKS, w.x, w.h, w.z, w.orientation);
}

function leapClear(w: Mover, dir: number): boolean {
  if (!canLeapDir(w.terrain, w.x, w.z, dir)) return false;
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  const mx = w.x + dx;
  const mz = w.z + dz;
  const ex = w.x + dx * LEAP_CELLS;
  const ez = w.z + dz * LEAP_CELLS;
  return !w.occupied(mx, mz) && !w.occupied(ex, ez);
}

function launch(w: Mover, mask: number): void {
  let dir = dirFromMask(mask);
  if (dir !== DIR_NONE && !leapClear(w, dir)) dir = DIR_NONE;
  const leap = dir !== DIR_NONE ? 1 : 0;
  const dest =
    leap === 1 ? leapPose(w.x, w.z, w.orientation, dir) : { x: w.x, z: w.z, ori: w.orientation };
  const destH = w.terrain.height(dest.x, dest.z);
  w.mode = MODE_AIR;
  w.dir = dir;
  w.phase = 0;
  w.duration = 0;
  w.startX = w.x;
  w.startH = w.h;
  w.startZ = w.z;
  w.startOri = w.orientation;
  w.destX = dest.x;
  w.destH = destH;
  w.destZ = dest.z;
  w.destOri = dest.ori;
  w.leap = leap;
  w.vy = JUMP_V0;
  w.airY = w.h + 0.5;
  w.flags |= FLAG_LAUNCH;
}

function grounded(w: Mover, mask: number): void {
  if (w.terrain.isGap(w.x, w.z)) {
    w.mode = MODE_FALL;
    w.airY = w.h + 0.5;
    w.vy = 0;
    return;
  }
  if (w.jumpBuf > 0) {
    w.jumpBuf = 0;
    tryJump(w);
    return;
  }
  handleGroundInput(w, mask);
}

function handleGroundInput(w: Mover, mask: number): void {
  const dir = dirFromMask(mask);
  if (dir === DIR_NONE) {
    w.moveLock = 0;
    return;
  }
  if (w.moveLock !== 0) return;
  if (w.pivotArmed !== 0) {
    w.pivotArmed = 0;
    w.moveLock = 1;
    startTuck(w, dir);
    return;
  }
  tryMove(w, dir);
}

function landRoll(w: Mover, mask: number): void {
  const down = w.destH < w.startH ? FLAG_LAND_DOWN : 0;
  const slideDir = w.dir;
  snapIdle(w, w.destX, w.destH, w.destZ, w.destOri);
  w.flags |= FLAG_LAND | down;
  if (tryStartSlide(w, slideDir)) return;
  grounded(w, mask);
}

function tryStartSlide(w: Mover, dir: number): boolean {
  if (dir === DIR_NONE) return false;
  if (!iceHas(w.ice, w.iceCount, w.x, w.z)) return false;
  const end = slideEnd(
    w.x,
    w.z,
    dir,
    (fx, fz, tx, tz) => canRollTo(w.terrain, fx, fz, tx, tz) && !w.occupied(tx, tz),
    (tx, tz) => iceHas(w.ice, w.iceCount, tx, tz),
    (tx, tz) => w.terrain.height(tx, tz),
  );
  if (!end) return false;
  beginMove(w, MODE_SLIDE, dir, end.cells * SLIDE_CELL_TICKS, end.x, end.h, end.z, w.orientation);
  return true;
}

function landSlide(w: Mover, mask: number): void {
  snapIdle(w, w.destX, w.destH, w.destZ, w.destOri);
  w.flags |= FLAG_LAND;
  grounded(w, mask);
}

function landAir(w: Mover, mask: number): void {
  if (w.leap === 1) {
    snapIdle(w, w.destX, w.destH, w.destZ, w.destOri);
  } else {
    snapIdle(w, w.startX, w.destH, w.startZ, w.startOri);
  }
  w.flags |= FLAG_LAND | FLAG_AIR_LAND;
  grounded(w, mask);
}

function landTuck(w: Mover, mask: number): void {
  snapIdle(w, w.startX, w.startH, w.startZ, w.destOri);
  w.flags |= FLAG_LAND;
  grounded(w, mask);
}

function respawn(w: Mover): void {
  snapIdle(w, w.spawnX, w.spawnH, w.spawnZ, w.spawnOri);
  w.jumpBuf = 0;
  w.pivotArmed = 0;
  w.moveLock = 0;
}

function stepFall(w: Mover): void {
  w.vy -= GRAV * FALL_GRAV_MUL * DT;
  w.airY += w.vy * DT;
  if (w.airY < FALL_KILL_Y) {
    w.flags |= FLAG_FALL_KILL;
    respawn(w);
  }
}

function stepAir(w: Mover, mask: number): void {
  const g = w.vy > -HANG && w.vy < HANG ? GRAV * HANG_AT : GRAV;
  w.vy -= g * DT;
  w.airY += w.vy * DT;
  w.phase += 1;
  const landY = w.destH + 0.5;
  if (w.airY <= landY && w.vy < 0) landAir(w, mask);
}

export function stepMovement(w: Mover, mask: number): void {
  w.flags = 0;
  if (rising(mask, w.prevMask, BUTTON_JUMP)) tryJump(w);
  if (rising(mask, w.prevMask, BUTTON_PIVOT)) w.pivotArmed = w.pivotArmed === 0 ? 1 : 0;

  if (w.mode === MODE_IDLE) handleGroundInput(w, mask);
  else if (w.mode === MODE_TUCK) {
    w.phase += 1;
    if (w.phase >= w.duration) landTuck(w, mask);
  } else if (w.mode === MODE_ROLL) {
    w.phase += 1;
    if (w.phase >= w.duration) landRoll(w, mask);
  } else if (w.mode === MODE_SLIDE) {
    w.phase += 1;
    if (w.phase >= w.duration) landSlide(w, mask);
  } else if (w.mode === MODE_FALL) stepFall(w);
  else if (w.mode === MODE_CROUCH) {
    w.phase += 1;
    if (w.phase >= w.duration) launch(w, mask);
  } else if (w.mode === MODE_AIR) stepAir(w, mask);

  if (w.jumpBuf > 0) w.jumpBuf -= 1;
  w.prevMask = mask;
}
