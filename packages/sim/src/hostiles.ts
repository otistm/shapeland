import {
  BANNER_CRACK,
  BANNER_NONE,
  DIR_DX,
  DIR_DZ,
  FLAG_AIR_LAND,
  FLAG_BLAST,
  FLAG_KILL,
  KILL_RANGE2,
  MODE_AIR,
  MODE_FALL,
  TURRET_IDLE,
  TURRET_RANGE2,
  TURRET_STATE_AIM,
  TURRET_STATE_COOL,
} from "./constants";
import {
  HOSTILE_CONE_SCOUT,
  HOSTILE_CONE_SPIRE,
  HOSTILE_CONE_WATCH,
  HOSTILE_COUNT,
  HOSTILE_SITES,
  HOSTILE_TETRA,
} from "./hostile-sites";
import { hurt } from "./combat";
import { ABILITY_FIRE, ABILITY_LIGHTNING, ABILITY_PHYSICAL } from "./loadout";
import { UP } from "./orientation";
import type { Terrain } from "./terrain";

export {
  HOSTILE_CONE_SCOUT,
  HOSTILE_CONE_SPIRE,
  HOSTILE_CONE_WATCH,
  HOSTILE_COUNT,
  HOSTILE_SITES,
  HOSTILE_TETRA,
} from "./hostile-sites";
export type { HostileKind, HostileSite } from "./hostile-sites";

/** Watch cone: 9 cells. Spire: 12. Tetra hunts inside 5. */
export const HOSTILE_WATCH_RANGE2 = 81;
export const HOSTILE_SPIRE_RANGE2 = 144;
export const HOSTILE_TETRA_RANGE2 = 25;
/** 0.6s. Still ≥ 2 dry rolls plus a short read; Blank cadence is tighter than the gauntlet. */
export const HOSTILE_AIM_TICKS = 72;
/** 1.05s. Beats i-frames so one source cannot double-hit; next telegraph comes fast. */
export const HOSTILE_COOL_TICKS = 126;
/** Spire keeps a longer read than a scout, still under a second. */
export const HOSTILE_SPIRE_AIM_TICKS = 96;
/** Spikes stay live after the highlight. Floor cells lie if they go cold while the mesh is up. */
export const HOSTILE_SPIKE_TICKS = 22;
/** One lattice step toward the cube while it stays in radius. Matches a grass roll. */
export const HOSTILE_CHASE_TICKS = 18;

const CROSS_DX = [0, 1, -1, 0, 0] as const;
const CROSS_DZ = [0, 0, 0, 1, -1] as const;
const RESIST_TICKS = 22;

export interface HostileOccupant {
  readonly hostileAlive: Uint8Array;
  readonly hostileX: Int16Array;
  readonly hostileZ: Int16Array;
}

export interface HostileHost extends HostileOccupant {
  x: number;
  z: number;
  h: number;
  orientation: number;
  mode: number;
  flags: number;
  faces: Uint8Array;
  aiming: number;
  sliceOn: number;
  banner: number;
  terrain: Terrain;
  iframes: number;
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
  tick: number;
  readonly hostileKind: Uint8Array;
  readonly hostileState: Uint8Array;
  readonly hostileT: Uint16Array;
  readonly hostileResist: Uint8Array;
  readonly hostileTeleN: Uint8Array;
  readonly hostileTeleX: Int16Array;
  readonly hostileTeleZ: Int16Array;
  occupied(x: number, z: number): boolean;
}

export function hostileRange2(kind: number): number {
  if (kind === HOSTILE_CONE_WATCH) return HOSTILE_WATCH_RANGE2;
  if (kind === HOSTILE_CONE_SPIRE) return HOSTILE_SPIRE_RANGE2;
  if (kind === HOSTILE_TETRA) return HOSTILE_TETRA_RANGE2;
  return TURRET_RANGE2;
}

export function hostileAimTicks(kind: number): number {
  return kind === HOSTILE_CONE_SPIRE ? HOSTILE_SPIRE_AIM_TICKS : HOSTILE_AIM_TICKS;
}

export function hostileCoolTicks(_kind: number): number {
  return HOSTILE_COOL_TICKS;
}

/** The tetra's missing exit — pose is a function of the cell. */
export function tetraSkipDir(x: number, z: number): number {
  return 1 + ((x + z) & 3);
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}

function canLurch(w: HostileHost, x: number, z: number, nx: number, nz: number): boolean {
  if (w.terrain.isWall(nx, nz) || w.terrain.isGap(nx, nz)) return false;
  const dh = w.terrain.height(nx, nz) - w.terrain.height(x, z);
  if (dh > 1 || dh < -1) return false;
  if (nx === w.x && nz === w.z) return true;
  return !w.occupied(nx, nz);
}

function tryStep(w: HostileHost, i: number, dir: number, px: number, pz: number): boolean {
  const x = w.hostileX[i] ?? 0;
  const z = w.hostileZ[i] ?? 0;
  const nx = x + (DIR_DX[dir] ?? 0);
  const nz = z + (DIR_DZ[dir] ?? 0);
  if (nx === px && nz === pz) return false;
  if (!canLurch(w, x, z, nx, nz)) return false;
  w.hostileX[i] = nx;
  w.hostileZ[i] = nz;
  return true;
}

/** Close one cell toward the cube. Tetra keeps its missing exit. */
export function chaseToward(w: HostileHost, i: number, px: number, pz: number): void {
  const x = w.hostileX[i] ?? 0;
  const z = w.hostileZ[i] ?? 0;
  const dx = px - x;
  const dz = pz - z;
  if (dx === 0 && dz === 0) return;
  const kind = w.hostileKind[i] ?? HOSTILE_CONE_SCOUT;
  const skip = kind === HOSTILE_TETRA ? tetraSkipDir(x, z) : 0;
  const adx = dx < 0 ? -dx : dx;
  const adz = dz < 0 ? -dz : dz;
  const primary = adx >= adz ? (dx > 0 ? 1 : 2) : dz < 0 ? 3 : 4;
  const secondary = adx >= adz ? (dz === 0 ? 0 : dz < 0 ? 3 : 4) : dx === 0 ? 0 : dx > 0 ? 1 : 2;
  if (primary !== skip && tryStep(w, i, primary, px, pz)) return;
  if (secondary !== 0 && secondary !== skip && tryStep(w, i, secondary, px, pz)) return;
  for (let d = 1; d <= 4; d++) {
    if (d === skip || d === primary || d === secondary) continue;
    if (tryStep(w, i, d, px, pz)) return;
  }
}

export function bootHostiles(w: HostileHost): void {
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    const site = HOSTILE_SITES[i];
    w.hostileAlive[i] = 1;
    w.hostileKind[i] = site?.[0] ?? HOSTILE_CONE_SCOUT;
    w.hostileX[i] = site?.[1] ?? 0;
    w.hostileZ[i] = site?.[2] ?? 0;
    w.hostileState[i] = TURRET_IDLE;
    w.hostileT[i] = 0;
    w.hostileResist[i] = 0;
    w.hostileTeleN[i] = 0;
  }
}

export function hostileOccupies(w: HostileOccupant, x: number, z: number): boolean {
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    if ((w.hostileAlive[i] ?? 0) === 0) continue;
    if (w.hostileX[i] === x && w.hostileZ[i] === z) return true;
  }
  return false;
}

function killHostile(w: HostileHost, i: number): void {
  w.hostileAlive[i] = 0;
  w.hostileState[i] = TURRET_IDLE;
  w.hostileResist[i] = 0;
  w.hostileTeleN[i] = 0;
  w.flags |= FLAG_KILL;
}

function fireKillsHostiles(w: HostileHost): number {
  let n = 0;
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    if ((w.hostileAlive[i] ?? 0) === 0) continue;
    if (dist2(w.x, w.z, w.hostileX[i] ?? 0, w.hostileZ[i] ?? 0) > KILL_RANGE2) continue;
    killHostile(w, i);
    n += 1;
  }
  return n;
}

function shrugHostiles(w: HostileHost): void {
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    if ((w.hostileAlive[i] ?? 0) === 0) continue;
    if (dist2(w.x, w.z, w.hostileX[i] ?? 0, w.hostileZ[i] ?? 0) > KILL_RANGE2) continue;
    w.hostileResist[i] = RESIST_TICKS;
  }
}

function captureCross(w: HostileHost, i: number, px: number, pz: number): void {
  let n = 0;
  const base = i * 5;
  for (let k = 0; k < 5; k++) {
    const x = px + (CROSS_DX[k] ?? 0);
    const z = pz + (CROSS_DZ[k] ?? 0);
    if (w.occupied(x, z)) continue;
    w.hostileTeleX[base + n] = x;
    w.hostileTeleZ[base + n] = z;
    n += 1;
  }
  w.hostileTeleN[i] = n;
}

function captureCell(w: HostileHost, i: number, x: number, z: number): void {
  w.hostileTeleX[i * 5] = x;
  w.hostileTeleZ[i * 5] = z;
  w.hostileTeleN[i] = 1;
}

function onTele(w: HostileHost, i: number, px: number, pz: number): boolean {
  const n = w.hostileTeleN[i] ?? 0;
  const base = i * 5;
  for (let k = 0; k < n; k++) {
    if (w.hostileTeleX[base + k] === px && w.hostileTeleZ[base + k] === pz) return true;
  }
  return false;
}

function strikeHits(w: HostileHost, i: number, px: number, pz: number): boolean {
  if (onTele(w, i, px, pz)) return true;
  const kind = w.hostileKind[i] ?? HOSTILE_CONE_SCOUT;
  return dist2(px, pz, w.hostileX[i] ?? 0, w.hostileZ[i] ?? 0) <= hostileRange2(kind);
}

function resolveStrike(w: HostileHost, i: number, px: number, pz: number, grounded: boolean): void {
  if (grounded && w.iframes <= 0 && strikeHits(w, i, px, pz)) hurt(w);
}

function pickTetraDest(w: HostileHost, i: number, px: number, pz: number): number {
  const x = w.hostileX[i] ?? 0;
  const z = w.hostileZ[i] ?? 0;
  const skip = tetraSkipDir(x, z);
  let bestX = x;
  let bestZ = z;
  let best = 999;
  let found = 0;
  for (let d = 1; d <= 4; d++) {
    if (d === skip) continue;
    const nx = x + (DIR_DX[d] ?? 0);
    const nz = z + (DIR_DZ[d] ?? 0);
    if (!canLurch(w, x, z, nx, nz)) continue;
    found = 1;
    const dx = nx - px;
    const dz = nz - pz;
    const adx = dx < 0 ? -dx : dx;
    const adz = dz < 0 ? -dz : dz;
    const cheb = adx > adz ? adx : adz;
    if (cheb < best) {
      best = cheb;
      bestX = nx;
      bestZ = nz;
    }
  }
  if (found === 0) return 0;
  captureCell(w, i, bestX, bestZ);
  return 1;
}

export function stepHostiles(w: HostileHost): void {
  if ((w.flags & FLAG_AIR_LAND) !== 0) {
    const up = w.faces[UP(w.orientation)] ?? 0;
    if (up === ABILITY_FIRE) {
      const n = fireKillsHostiles(w);
      if (n > 0 && w.banner === BANNER_NONE) w.banner = BANNER_CRACK;
    } else if (up === ABILITY_LIGHTNING || up === ABILITY_PHYSICAL) {
      shrugHostiles(w);
    }
  }

  const px = w.x;
  const pz = w.z;
  const grounded = w.mode !== MODE_AIR && w.mode !== MODE_FALL;
  let aiming = 0;
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    if ((w.hostileAlive[i] ?? 0) === 0) continue;
    const resist = w.hostileResist[i] ?? 0;
    if (resist > 0) w.hostileResist[i] = resist - 1;
    const kind = w.hostileKind[i] ?? HOSTILE_CONE_SCOUT;
    const range2 = hostileRange2(kind);
    if (
      dist2(px, pz, w.hostileX[i] ?? 0, w.hostileZ[i] ?? 0) <= range2 &&
      w.tick > 0 &&
      w.tick % HOSTILE_CHASE_TICKS === 0
    ) {
      chaseToward(w, i, px, pz);
    }
    const tx = w.hostileX[i] ?? 0;
    const tz = w.hostileZ[i] ?? 0;
    const d2 = dist2(px, pz, tx, tz);
    const state = w.hostileState[i] ?? 0;
    const aimTicks = hostileAimTicks(kind);
    const coolTicks = hostileCoolTicks(kind);
    if (state === TURRET_IDLE) {
      if (d2 <= range2 && w.mode !== MODE_FALL) {
        w.hostileState[i] = TURRET_STATE_AIM;
        w.hostileT[i] = 0;
        if (kind === HOSTILE_TETRA) {
          if (pickTetraDest(w, i, px, pz) === 0) w.hostileState[i] = TURRET_IDLE;
        } else captureCross(w, i, px, pz);
      }
    } else if (state === TURRET_STATE_AIM) {
      aiming = 1;
      const t = (w.hostileT[i] ?? 0) + 1;
      w.hostileT[i] = t;
      if (t >= aimTicks) {
        w.hostileState[i] = TURRET_STATE_COOL;
        w.hostileT[i] = 0;
        w.flags |= FLAG_BLAST;
        resolveStrike(w, i, px, pz, grounded);
        if (kind === HOSTILE_TETRA) {
          const dx = w.hostileTeleX[i * 5] ?? tx;
          const dz = w.hostileTeleZ[i * 5] ?? tz;
          if (!(dx === px && dz === pz) && canLurch(w, tx, tz, dx, dz)) {
            w.hostileX[i] = dx;
            w.hostileZ[i] = dz;
          }
        }
      }
    } else if (state === TURRET_STATE_COOL) {
      const t = (w.hostileT[i] ?? 0) + 1;
      w.hostileT[i] = t;
      if (t <= HOSTILE_SPIKE_TICKS) resolveStrike(w, i, px, pz, grounded);
      else w.hostileTeleN[i] = 0;
      if (t >= coolTicks) {
        w.hostileState[i] = TURRET_IDLE;
        w.hostileTeleN[i] = 0;
      }
    }
  }
  if (w.sliceOn === 0) w.aiming = aiming;
  else if (aiming !== 0) w.aiming = 1;
}
