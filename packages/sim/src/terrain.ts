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
  private readonly walls = new Set<number>();
  private readonly gaps = new Set<number>();

  height(x: number, z: number): number {
    return this.heights.get(packXZ(x, z)) ?? 0;
  }

  setHeight(x: number, z: number, h: number): void {
    this.heights.set(packXZ(x, z), h | 0);
  }

  setWall(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) this.walls.add(k);
    else this.walls.delete(k);
  }

  setGap(x: number, z: number, on = true): void {
    const k = packXZ(x, z);
    if (on) this.gaps.add(k);
    else this.gaps.delete(k);
  }

  isWall(x: number, z: number): boolean {
    return this.walls.has(packXZ(x, z));
  }

  isGap(x: number, z: number): boolean {
    return this.gaps.has(packXZ(x, z));
  }
}
