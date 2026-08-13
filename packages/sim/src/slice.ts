import {
  BANNER_CLEAR,
  BANNER_CRACK,
  BANNER_DOOR,
  BANNER_GLYPH,
  BANNER_NONE,
  BANNER_SHRINE,
  FLAG_AIR_LAND,
  FLAG_BLAST,
  FLAG_DOOR,
  FLAG_FALL_KILL,
  FLAG_HURT,
  FLAG_KILL,
  FLAG_LAND,
  INTEGRITY,
  I_FRAMES_TICKS,
  KILL_RANGE2,
  MODE_AIR,
  MODE_FALL,
  MODE_IDLE,
  REGION_CHAMBER,
  REGION_GAUNTLET,
  RESPAWN_IFRAMES,
  STAGE_DONE,
  STAGE_INSIDE,
  STAGE_RAISE,
  STAGE_SEEK,
  STAGE_TRAVEL,
  TURRET_AIM_TICKS,
  TURRET_COOL_TICKS,
  TURRET_COUNT,
  TURRET_IDLE,
  TURRET_RANGE2,
  TURRET_STATE_AIM,
  TURRET_STATE_COOL,
} from "./constants";
import { ABILITY_FIRE, ABILITY_LIGHTNING, ABILITY_PHYSICAL, grantAbility } from "./loadout";
import { DOWN, UP } from "./orientation";
import { type Terrain, terraceHill } from "./terrain";

export const SHRINE = { x: 0, z: -7 } as const;
export const SOCKET = { x: 0, z: -20 } as const;
export const DOOR = { x: 0, z: -22 } as const;
export const GLYPH = { x: 0, z: -25 } as const;
export const NPC = { x: 3, z: -5 } as const;
export const START = { x: 0, z: 0 } as const;

export const TURRET_SITES: ReadonlyArray<readonly [number, number]> = [
  [2, -15],
  [-2, -15],
  [4, -18],
  [-4, -18],
  [1, -19],
];

export const SLICE_HILLS: ReadonlyArray<readonly [number, number, number]> = [
  [7, -3, 3],
  [-7, -16, 2],
];

const CROSS_DX = [0, 1, -1, 0, 0] as const;
const CROSS_DZ = [0, 0, 0, 1, -1] as const;
const RESIST_TICKS = 22;

export interface SliceHost {
  x: number;
  z: number;
  h: number;
  orientation: number;
  mode: number;
  flags: number;
  faces: Uint8Array;
  found: number;
  integrity: number;
  spawnX: number;
  spawnH: number;
  spawnZ: number;
  spawnOri: number;
  terrain: Terrain;
  vy: number;
  airY: number;
  jumpBuf: number;
  pivotArmed: number;
  moveLock: number;
  sliceOn: number;
  stage: number;
  doorOpen: number;
  shrineTaken: number;
  glyphTaken: number;
  iframes: number;
  npcRange: number;
  banner: number;
  region: number;
  announced: number;
  npcOn: number;
  aiming: number;
  turretAlive: number;
  readonly turretX: Int8Array;
  readonly turretZ: Int8Array;
  readonly turretState: Uint8Array;
  readonly turretT: Uint16Array;
  readonly turretResist: Uint8Array;
  readonly teleN: Uint8Array;
  readonly teleX: Int8Array;
  readonly teleZ: Int8Array;
}

export function stampSlice(terrain: Terrain): void {
  for (let x = -7; x <= 7; x++) terrain.setGap(x, -12);
  for (let x = -3; x <= 3; x++) {
    if (x !== 0) terrain.setWall(x, -22);
  }
  for (let z = -23; z >= -27; z--) {
    terrain.setWall(-3, z);
    terrain.setWall(3, z);
  }
  for (let x = -3; x <= 3; x++) terrain.setWall(x, -28);
  for (const [cx, cz, peak] of SLICE_HILLS) terraceHill(terrain, cx, cz, peak);
}

export function bootSlice(w: SliceHost): void {
  stampSlice(w.terrain);
  w.sliceOn = 1;
  w.npcOn = 1;
  w.doorOpen = 0;
  w.stage = STAGE_SEEK;
  w.shrineTaken = 0;
  w.glyphTaken = 0;
  w.turretAlive = (1 << TURRET_COUNT) - 1;
  for (let i = 0; i < TURRET_COUNT; i++) {
    const site = TURRET_SITES[i];
    w.turretX[i] = site?.[0] ?? 0;
    w.turretZ[i] = site?.[1] ?? 0;
    w.turretState[i] = TURRET_IDLE;
    w.turretT[i] = 0;
    w.turretResist[i] = 0;
    w.teleN[i] = 0;
  }
}

export function occupied(w: SliceHost, x: number, z: number): boolean {
  if (w.terrain.isWall(x, z)) return true;
  if (w.sliceOn !== 0 && w.doorOpen === 0 && x === DOOR.x && z === DOOR.z) return true;
  if (w.npcOn !== 0 && x === NPC.x && z === NPC.z) return true;
  for (let i = 0; i < TURRET_COUNT; i++) {
    if ((w.turretAlive & (1 << i)) === 0) continue;
    if (w.turretX[i] === x && w.turretZ[i] === z) return true;
  }
  return false;
}

export function regionOf(x: number, z: number, doorOpen: number): number {
  if (doorOpen !== 0 && x >= -2 && x <= 2 && z <= -22 && z >= -27) return REGION_CHAMBER;
  if (z <= -12) return REGION_GAUNTLET;
  return 0;
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function snapIdle(w: SliceHost, x: number, h: number, z: number, ori: number): void {
  w.x = x;
  w.h = h;
  w.z = z;
  w.orientation = ori;
  w.mode = MODE_IDLE;
  w.vy = 0;
  w.airY = h + 0.5;
}

export function respawnAtAnchor(w: SliceHost): void {
  snapIdle(w, w.spawnX, w.spawnH, w.spawnZ, w.spawnOri);
  w.jumpBuf = 0;
  w.pivotArmed = 0;
  w.moveLock = 0;
  w.integrity = INTEGRITY;
  w.iframes = RESPAWN_IFRAMES;
}

export function hurt(w: SliceHost): void {
  if (w.iframes > 0) return;
  w.integrity -= 1;
  w.iframes = I_FRAMES_TICKS;
  w.flags |= FLAG_HURT;
  if (w.integrity <= 0) respawnAtAnchor(w);
}

function stampDown(w: SliceHost, ability: number): void {
  w.found = grantAbility(w.found, ability);
  w.faces[DOWN(w.orientation)] = ability;
}

function killTurret(w: SliceHost, i: number): void {
  w.turretAlive &= ~(1 << i);
  w.turretState[i] = TURRET_IDLE;
  w.turretResist[i] = 0;
  w.teleN[i] = 0;
  w.flags |= FLAG_KILL;
}

function fireKills(w: SliceHost): number {
  let n = 0;
  for (let i = 0; i < TURRET_COUNT; i++) {
    if ((w.turretAlive & (1 << i)) === 0) continue;
    if (dist2(w.x, w.z, w.turretX[i] ?? 0, w.turretZ[i] ?? 0) > KILL_RANGE2) continue;
    killTurret(w, i);
    n += 1;
  }
  return n;
}

function shrug(w: SliceHost): void {
  for (let i = 0; i < TURRET_COUNT; i++) {
    if ((w.turretAlive & (1 << i)) === 0) continue;
    if (dist2(w.x, w.z, w.turretX[i] ?? 0, w.turretZ[i] ?? 0) > KILL_RANGE2) continue;
    w.turretResist[i] = RESIST_TICKS;
  }
}

function openDoor(w: SliceHost): void {
  w.doorOpen = 1;
  w.stage = STAGE_INSIDE;
  w.banner = BANNER_DOOR;
  w.flags |= FLAG_DOOR;
}

function captureCross(w: SliceHost, i: number, px: number, pz: number): void {
  let n = 0;
  const base = i * 5;
  for (let k = 0; k < 5; k++) {
    const x = px + (CROSS_DX[k] ?? 0);
    const z = pz + (CROSS_DZ[k] ?? 0);
    if (occupied(w, x, z)) continue;
    w.teleX[base + n] = x;
    w.teleZ[base + n] = z;
    n += 1;
  }
  w.teleN[i] = n;
}

function onCross(w: SliceHost, i: number, px: number, pz: number): boolean {
  const n = w.teleN[i] ?? 0;
  const base = i * 5;
  for (let k = 0; k < n; k++) {
    if (w.teleX[base + k] === px && w.teleZ[base + k] === pz) return true;
  }
  return false;
}

function stepTurrets(w: SliceHost): void {
  const px = w.x;
  const pz = w.z;
  const grounded = w.mode !== MODE_AIR && w.mode !== MODE_FALL;
  let aiming = 0;
  for (let i = 0; i < TURRET_COUNT; i++) {
    if ((w.turretAlive & (1 << i)) === 0) continue;
    const resist = w.turretResist[i] ?? 0;
    if (resist > 0) w.turretResist[i] = resist - 1;
    const tx = w.turretX[i] ?? 0;
    const tz = w.turretZ[i] ?? 0;
    const d2 = dist2(px, pz, tx, tz);
    const state = w.turretState[i] ?? 0;
    if (state === TURRET_IDLE) {
      if (d2 <= TURRET_RANGE2 && w.mode !== MODE_FALL) {
        w.turretState[i] = TURRET_STATE_AIM;
        w.turretT[i] = 0;
        captureCross(w, i, px, pz);
      }
    } else if (state === TURRET_STATE_AIM) {
      aiming = 1;
      const t = (w.turretT[i] ?? 0) + 1;
      w.turretT[i] = t;
      if (t >= TURRET_AIM_TICKS) {
        w.turretState[i] = TURRET_STATE_COOL;
        w.turretT[i] = 0;
        w.flags |= FLAG_BLAST;
        if (grounded && w.iframes <= 0 && onCross(w, i, px, pz)) hurt(w);
        w.teleN[i] = 0;
      }
    } else if (state === TURRET_STATE_COOL) {
      const t = (w.turretT[i] ?? 0) + 1;
      w.turretT[i] = t;
      if (t >= TURRET_COOL_TICKS) w.turretState[i] = TURRET_IDLE;
    }
  }
  w.aiming = aiming;
}

export function stepSlice(w: SliceHost): void {
  if (w.sliceOn === 0) return;
  w.banner = BANNER_NONE;
  if (w.iframes > 0) w.iframes -= 1;

  if ((w.flags & FLAG_FALL_KILL) !== 0) {
    w.integrity = INTEGRITY;
    w.iframes = RESPAWN_IFRAMES;
  }

  if ((w.flags & FLAG_LAND) !== 0 || (w.flags & FLAG_AIR_LAND) !== 0) {
    if (w.shrineTaken === 0 && w.x === SHRINE.x && w.z === SHRINE.z) {
      w.shrineTaken = 1;
      w.spawnX = w.x;
      w.spawnH = w.h;
      w.spawnZ = w.z;
      w.spawnOri = w.orientation;
      stampDown(w, ABILITY_FIRE);
      w.stage = STAGE_RAISE;
      w.banner = BANNER_SHRINE;
    }
    if (w.doorOpen !== 0 && w.glyphTaken === 0 && w.x === GLYPH.x && w.z === GLYPH.z) {
      w.glyphTaken = 1;
      stampDown(w, ABILITY_LIGHTNING);
      w.stage = STAGE_DONE;
      w.banner = BANNER_GLYPH;
    }
    if (w.doorOpen === 0 && w.x === SOCKET.x && w.z === SOCKET.z) {
      if ((w.faces[DOWN(w.orientation)] ?? 0) === ABILITY_FIRE) openDoor(w);
    }
  }

  if ((w.flags & FLAG_AIR_LAND) !== 0) {
    const up = w.faces[UP(w.orientation)] ?? 0;
    if (up === ABILITY_FIRE) {
      const n = fireKills(w);
      if (n > 0) w.banner = w.turretAlive === 0 ? BANNER_CLEAR : BANNER_CRACK;
    } else if (up === ABILITY_LIGHTNING || up === ABILITY_PHYSICAL) {
      shrug(w);
    }
  }

  if (w.stage === STAGE_RAISE && (w.faces[UP(w.orientation)] ?? 0) === ABILITY_FIRE) {
    w.stage = STAGE_TRAVEL;
  }

  stepTurrets(w);

  if (w.mode !== MODE_FALL) {
    const r = regionOf(w.x, w.z, w.doorOpen);
    if ((w.announced & (1 << r)) === 0) {
      w.announced |= 1 << r;
      w.region = r;
    }
  }

  const dx = w.x - NPC.x;
  const dz = w.z - NPC.z;
  const adx = dx < 0 ? -dx : dx;
  const adz = dz < 0 ? -dz : dz;
  const cheb = adx > adz ? adx : adz;
  if (w.npcRange === 0) w.npcRange = cheb <= 1 ? 1 : 0;
  else w.npcRange = cheb <= 2 ? 1 : 0;
}
