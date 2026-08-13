import { DIR_DX, DIR_DZ, ICE_MAX, KILL_RANGE2, SLIDE_MAX } from "./constants";
import { fnv1aStart, fnv1aU32 } from "./hash";
import { packXZ, type Terrain } from "./terrain";

export interface IceHost {
  ice: Uint32Array;
  iceH: Int8Array;
  iceCount: number;
  iceHash: number;
  scorch: Uint32Array;
  scorchH: Int8Array;
  scorchCount: number;
  scorchHash: number;
  terrain: Terrain;
}

function findKey(keys: Uint32Array, count: number, key: number): number {
  for (let i = 0; i < count; i++) if (keys[i] === key) return i;
  return -1;
}

export function iceHas(ice: Uint32Array, count: number, x: number, z: number): boolean {
  return findKey(ice, count, packXZ(x, z) >>> 0) >= 0;
}

function removeAt(
  keys: Uint32Array,
  heights: Int8Array,
  count: number,
  i: number,
): number {
  const last = count - 1;
  if (i < last) {
    keys[i] = keys[last] ?? 0;
    heights[i] = heights[last] ?? 0;
  }
  return last;
}

function hashKeys(keys: Uint32Array, count: number): number {
  let h = fnv1aStart();
  for (let i = 0; i < count; i++) h = fnv1aU32(h, keys[i] ?? 0);
  return h;
}

export function icePaint(w: IceHost, x: number, z: number): void {
  const key = packXZ(x, z) >>> 0;
  if (findKey(w.ice, w.iceCount, key) >= 0) return;
  if (w.iceCount >= ICE_MAX) return;
  const i = w.iceCount;
  w.ice[i] = key;
  w.iceH[i] = w.terrain.height(x, z) | 0;
  w.iceCount = i + 1;
  w.iceHash = hashKeys(w.ice, w.iceCount);
  const si = findKey(w.scorch, w.scorchCount, key);
  if (si >= 0) {
    w.scorchCount = removeAt(w.scorch, w.scorchH, w.scorchCount, si);
    w.scorchHash = hashKeys(w.scorch, w.scorchCount);
  }
}

export function iceMelt(w: IceHost, x: number, z: number): void {
  const key = packXZ(x, z) >>> 0;
  const i = findKey(w.ice, w.iceCount, key);
  if (i < 0) return;
  w.iceCount = removeAt(w.ice, w.iceH, w.iceCount, i);
  w.iceHash = hashKeys(w.ice, w.iceCount);
}

export function freezePatch(w: IceHost, cx: number, cz: number): void {
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > KILL_RANGE2) continue;
      icePaint(w, cx + dx, cz + dz);
    }
  }
}

export function slideEnd(
  x: number,
  z: number,
  dir: number,
  canEnter: (fromX: number, fromZ: number, toX: number, toZ: number) => boolean,
  slick: (tx: number, tz: number) => boolean,
  height: (tx: number, tz: number) => number,
): { x: number; z: number; h: number; cells: number } | null {
  const dx = DIR_DX[dir] ?? 0;
  const dz = DIR_DZ[dir] ?? 0;
  let cx = x;
  let cz = z;
  let cells = 0;
  for (let i = 0; i < SLIDE_MAX; i++) {
    const nx = cx + dx;
    const nz = cz + dz;
    if (!canEnter(cx, cz, nx, nz)) break;
    cx = nx;
    cz = nz;
    cells += 1;
    if (!slick(cx, cz)) break;
  }
  if (cells === 0) return null;
  return { x: cx, z: cz, h: height(cx, cz), cells };
}
