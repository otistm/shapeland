import { STRUCTURE_PEAK_MAX, TERRAIN_PEAK_MAX } from "./constants";

/** Occupancy keys, not meshes. Packed xz, integer heights, O(1) lookups. */

export function packXZ(x: number, z: number): number {
  return ((x + 32768) & 0xffff) | (((z + 32768) & 0xffff) << 16);
}

export function unpackXZ(key: number): { x: number; z: number } {
  return {
    x: (key & 0xffff) - 32768,
    z: ((key >>> 16) & 0xffff) - 32768,
  };
}

export class Terrain {
  private readonly heights = new Map<number, number>();
  /** Occupancy. Value 0 is a slice wall (decorative render); >0 is a structure pier's visual height. */
  private readonly walls = new Map<number, number>();
  private readonly gaps = new Set<number>();
  private readonly water = new Set<number>();
  private readonly swamp = new Set<number>();
  private readonly grass = new Set<number>();

  height(x: number, z: number): number {
    return this.heights.get(packXZ(x, z)) ?? 0;
  }

  setHeight(x: number, z: number, h: number): void {
    this.heights.set(packXZ(x, z), h | 0);
  }

  setWall(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) {
      if (!this.walls.has(k)) this.walls.set(k, 0);
    } else this.walls.delete(k);
  }

  /**
   * Structure mass. Visual height from y=0, occupancy like a wall. Clamped to STRUCTURE_PEAK_MAX.
   * Collision data, not a walkable height — the cube never stands on this value.
   */
  setPier(x: number, z: number, h: number): void {
    const k = packXZ(x, z);
    const raw = h | 0;
    if (raw < 1) {
      this.walls.delete(k);
      return;
    }
    const vis = raw > STRUCTURE_PEAK_MAX ? STRUCTURE_PEAK_MAX : raw;
    this.walls.set(k, vis);
  }

  wallHeight(x: number, z: number): number {
    return this.walls.get(packXZ(x, z)) ?? 0;
  }

  setGap(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) {
      this.gaps.add(k);
      this.water.delete(k);
      this.swamp.delete(k);
      this.grass.delete(k);
    } else this.gaps.delete(k);
  }

  /** Walkable wet cell. Mutually exclusive with gap, swamp, and grass. Independent of height. */
  setWater(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) {
      if (this.gaps.has(k)) return;
      this.swamp.delete(k);
      this.grass.delete(k);
      this.water.add(k);
    } else this.water.delete(k);
  }

  /** Walkable mud cell. Mutually exclusive with gap, water, and grass. Independent of height. */
  setSwamp(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) {
      if (this.gaps.has(k)) return;
      this.water.delete(k);
      this.grass.delete(k);
      this.swamp.add(k);
    } else this.swamp.delete(k);
  }

  /** Walkable meadow cell. Mutually exclusive with gap, water, and swamp. Independent of height. */
  setGrass(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) {
      if (this.gaps.has(k)) return;
      this.water.delete(k);
      this.swamp.delete(k);
      this.grass.add(k);
    } else this.grass.delete(k);
  }

  isWall(x: number, z: number): boolean {
    return this.walls.has(packXZ(x, z));
  }

  isGap(x: number, z: number): boolean {
    return this.gaps.has(packXZ(x, z));
  }

  isWater(x: number, z: number): boolean {
    return this.water.has(packXZ(x, z));
  }

  isSwamp(x: number, z: number): boolean {
    return this.swamp.has(packXZ(x, z));
  }

  isGrass(x: number, z: number): boolean {
    return this.grass.has(packXZ(x, z));
  }

  forEachWall(fn: (x: number, z: number, h: number) => void): void {
    for (const [key, h] of this.walls) {
      const p = unpackXZ(key);
      fn(p.x, p.z, h);
    }
  }

  forEachGap(fn: (x: number, z: number) => void): void {
    for (const key of this.gaps) {
      const p = unpackXZ(key);
      fn(p.x, p.z);
    }
  }

  forEachWater(fn: (x: number, z: number) => void): void {
    for (const key of this.water) {
      const p = unpackXZ(key);
      fn(p.x, p.z);
    }
  }

  forEachSwamp(fn: (x: number, z: number) => void): void {
    for (const key of this.swamp) {
      const p = unpackXZ(key);
      fn(p.x, p.z);
    }
  }

  forEachGrass(fn: (x: number, z: number) => void): void {
    for (const key of this.grass) {
      const p = unpackXZ(key);
      fn(p.x, p.z);
    }
  }

  forEachHeight(fn: (x: number, z: number, h: number) => void): void {
    for (const [key, h] of this.heights) {
      const p = unpackXZ(key);
      fn(p.x, p.z, h);
    }
  }
}

/** The only sanctioned height writer besides tests. Peak − Chebyshev ring. */
export function raiseRect(
  terrain: Terrain,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
): void {
  const height = h | 0;
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      if (height > terrain.height(x, z)) terrain.setHeight(x, z, height);
    }
  }
}

function clampTop(top: number): number {
  const t = top | 0;
  if (t > TERRAIN_PEAK_MAX) return TERRAIN_PEAK_MAX;
  return t;
}

function nonNegative(n: number): number {
  const v = n | 0;
  return v < 0 ? 0 : v;
}

/**
 * Flat-topped platform with a staircase apron. The whole authored form vocabulary:
 * `halfW === halfD === 0` is a peak, a long thin core is a ridge, a wide core is a mesa or
 * ziggurat. `tread` is the run per 1-unit rise — 1 is a service climb, 2 a grand stair, 3 a
 * processional slope — so the apron is a staircase on every side by construction and the summit is
 * roll-reachable without a proof needing to search for a way up.
 */
export function bench(
  terrain: Terrain,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  top: number,
  tread = 1,
): void {
  const t = clampTop(top);
  if (t < 1) return;
  const w = nonNegative(halfW);
  const d = nonNegative(halfD);
  const run = tread < 1 ? 1 : tread | 0;
  for (let s = 0; s < t; s++) {
    const grow = s * run;
    raiseRect(terrain, cx - w - grow, cz - d - grow, cx + w + grow, cz + d + grow, t - s);
  }
}

/**
 * Stepped basin inside a rim, after Pamukkale's terrace-mound pools. Every ring is a ±1 step, so
 * the floor is exitable in both directions — a basin, never a pit. Water is a surface kind painted
 * on the floor afterwards; the depression itself carries no colour.
 */
export function terracePool(
  terrain: Terrain,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rimTop: number,
  steps: number,
): void {
  const rim = clampTop(rimTop);
  if (rim < 1) return;
  bench(terrain, cx, cz, halfW, halfD, rim, 1);
  const w = nonNegative(halfW);
  const d = nonNegative(halfD);
  for (let s = 1; s <= (steps | 0); s++) {
    const h = rim - s;
    const iw = w - s;
    const id = d - s;
    if (h < 0 || iw < 0 || id < 0) return;
    for (let x = cx - iw; x <= cx + iw; x++) {
      for (let z = cz - id; z <= cz + id; z++) terrain.setHeight(x, z, h);
    }
  }
}

/** Floor of a `terracePool`, i.e. where its water sits. */
export function poolFloor(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rimTop: number,
  steps: number,
): { x0: number; z0: number; x1: number; z1: number; h: number } {
  const rim = rimTop > TERRAIN_PEAK_MAX ? TERRAIN_PEAK_MAX : rimTop | 0;
  const w = nonNegative(halfW);
  const d = nonNegative(halfD);
  let s = 0;
  while (s < (steps | 0) && rim - (s + 1) >= 0 && w - (s + 1) >= 0 && d - (s + 1) >= 0) s += 1;
  return { x0: cx - (w - s), z0: cz - (d - s), x1: cx + (w - s), z1: cz + (d - s), h: rim - s };
}

export function terraceHill(terrain: Terrain, cx: number, cz: number, peak: number): void {
  bench(terrain, cx, cz, 0, 0, peak, 1);
}
