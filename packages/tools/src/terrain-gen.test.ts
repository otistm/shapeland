import {
  BLANK_BENCHES,
  BLANK_GAPS,
  BLANK_GRASS,
  BLANK_HILLS,
  BLANK_PIERS,
  BLANK_POIS,
  BLANK_POOLS,
  BLANK_STAMP_SEED,
  BLANK_SWAMP,
  BLANK_WATER,
  BLANK_X0,
  BLANK_X1,
  BLANK_Z0,
  BLANK_Z1,
  FLOOR_SIZE,
  SLICE_RESERVE,
  TERRAIN_FILLER_PEAK_MAX,
  TERRAIN_PEAK_MAX,
} from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { GRIKE_CANYONS, POI_CEILING, planBenches, planPois, planPools } from "./blank-plan";
import { benchExtent, generateBlank, validatePlan } from "./terrain-gen";

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

/** Two boxes overlap only when both axes do. */
function overlaps(a: Box, b: Box): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1;
}

function chebToBox(
  x: number,
  z: number,
  box: { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number },
): number {
  const dx = x < box.x0 ? box.x0 - x : x > box.x1 ? x - box.x1 : 0;
  const dz = z < box.z0 ? box.z0 - z : z > box.z1 ? z - box.z1 : 0;
  return dx > dz ? dx : dz;
}

describe("blank terrain plan", () => {
  it("is valid before anything is generated from it", () => {
    expect(validatePlan()).toEqual([]);
  });

  it("keeps every authored form on the floor, off the reserve, and off the spine", () => {
    const spine = { x0: -1, x1: 1, z0: -8, z1: 1 };
    for (const b of [
      ...planBenches(),
      ...planPools().map((p) => ({ ...p, top: p.rimTop, tread: 1 })),
    ]) {
      const box = benchExtent(b);
      expect(box.x0).toBeGreaterThanOrEqual(BLANK_X0);
      expect(box.x1).toBeLessThanOrEqual(BLANK_X1);
      expect(box.z0).toBeGreaterThanOrEqual(BLANK_Z0);
      expect(box.z1).toBeLessThanOrEqual(BLANK_Z1);
      expect(overlaps(box, SLICE_RESERVE)).toBe(false);
      expect(overlaps(box, spine)).toBe(false);
      expect(b.top).toBeLessThanOrEqual(TERRAIN_PEAK_MAX);
    }
  });

  it("names every place after a real landform and labels reachable ground", () => {
    const pois = planPois();
    expect(pois.length).toBeGreaterThanOrEqual(12);
    for (const poi of pois) {
      expect(poi.ref.length).toBeGreaterThan(0);
      expect(chebToBox(poi.x, poi.z, SLICE_RESERVE)).toBeGreaterThan(0);
    }
  });

  it("commits to a point of interest at least every 211 cells", () => {
    const left = [...planPois()];
    let cx = 0;
    let cz = 0;
    while (left.length) {
      let bestIdx = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < left.length; i++) {
        const p = left[i];
        if (!p) continue;
        const d = Math.abs(p.x - cx) + Math.abs(p.z - cz);
        if (d < best) {
          best = d;
          bestIdx = i;
        }
      }
      const next = left.splice(bestIdx, 1)[0];
      if (!next) break;
      expect(best).toBeLessThanOrEqual(POI_CEILING);
      cx = next.x;
      cz = next.z;
    }
  });
});

describe("blank terrain bake", () => {
  it("covers the floor mesh, not a pocket and not a million-cell strip", () => {
    expect(BLANK_X1 - BLANK_X0 + 1).toBe(FLOOR_SIZE);
    expect(BLANK_Z1 - BLANK_Z0 + 1).toBe(FLOOR_SIZE);
    expect(FLOOR_SIZE).toBe(320);
  });

  it("is a reproducible bake of authored forms, not analog noise", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    expect(stamp.seed).toBe(BLANK_STAMP_SEED);
    expect(stamp.benches.map((b) => [b.cx, b.cz, b.halfW, b.halfD, b.top, b.tread])).toEqual(
      BLANK_BENCHES.map((b) => [...b]),
    );
    expect(stamp.pools.map((p) => [p.cx, p.cz, p.halfW, p.halfD, p.rimTop, p.steps])).toEqual(
      BLANK_POOLS.map((p) => [...p]),
    );
    expect(stamp.hills).toEqual(BLANK_HILLS);
    expect(stamp.gaps).toEqual(BLANK_GAPS);
    expect(stamp.water).toEqual(BLANK_WATER);
    expect(stamp.swamp).toEqual(BLANK_SWAMP);
    expect(stamp.grass).toEqual(BLANK_GRASS);
    expect(stamp.piers).toEqual(BLANK_PIERS);
    expect(stamp.hills[0]).toEqual([7, -3, 3]);
    expect(BLANK_POIS.length).toBe(planPois().length);
  });

  it("authors three N–S grike canyons as a 1-cell grain, not confetti", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    const gapSet = new Set(stamp.gaps.map(([x, z]) => `${x},${z}`));
    for (const c of GRIKE_CANYONS) {
      let run = 0;
      for (let z = c.z0; z <= c.z1; z++) {
        if (!gapSet.has(`${c.x},${z}`)) continue;
        run += 1;
        expect(gapSet.has(`${c.x - 1},${z}`)).toBe(false);
        expect(gapSet.has(`${c.x + 1},${z}`)).toBe(false);
      }
      expect(run).toBeGreaterThan(40);
    }
  });

  it("reaches the new ceiling and keeps noise filler below the named landmarks", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    expect(TERRAIN_PEAK_MAX).toBe(8);
    expect(Math.max(...stamp.benches.map((b) => b.top))).toBe(TERRAIN_PEAK_MAX);
    for (const [, , peak] of stamp.hills) {
      expect(peak).toBeGreaterThanOrEqual(1);
      expect(peak).toBeLessThanOrEqual(TERRAIN_FILLER_PEAK_MAX);
    }
  });

  it("places features across the floor and never inside the gauntlet reserve", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    const mark = (x: number, z: number) => {
      expect(x).toBeGreaterThanOrEqual(BLANK_X0);
      expect(x).toBeLessThanOrEqual(BLANK_X1);
      expect(z).toBeGreaterThanOrEqual(BLANK_Z0);
      expect(z).toBeLessThanOrEqual(BLANK_Z1);
      expect(chebToBox(x, z, SLICE_RESERVE)).toBeGreaterThan(0);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    };
    for (const [x, z, peak] of stamp.hills) {
      mark(x, z);
      expect(chebToBox(x, z, SLICE_RESERVE)).toBeGreaterThanOrEqual(peak);
    }
    for (const [x, z] of [...stamp.gaps, ...stamp.water, ...stamp.swamp, ...stamp.grass])
      mark(x, z);
    expect(maxX - minX).toBeGreaterThan(200);
    expect(maxZ - minZ).toBeGreaterThan(200);
  });

  it("never opens a gap in an apron, which could sever the only stair to a summit", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    const raised = new Map<string, number>();
    for (const b of stamp.benches) {
      const box = benchExtent(b);
      const top = b.top;
      const run = b.tread < 1 ? 1 : b.tread;
      for (let x = box.x0; x <= box.x1; x++) {
        for (let z = box.z0; z <= box.z1; z++) {
          const outX = Math.max(0, Math.abs(x - b.cx) - b.halfW);
          const outZ = Math.max(0, Math.abs(z - b.cz) - b.halfD);
          const ring = Math.ceil(Math.max(outX, outZ) / run);
          const h = top - ring;
          if (h > (raised.get(`${x},${z}`) ?? 0)) raised.set(`${x},${z}`, h);
        }
      }
    }
    for (const [x, z] of stamp.gaps) {
      expect((raised.get(`${x},${z}`) ?? 0) <= 0).toBe(true);
    }
  });

  it("keeps grass off gaps, off wet cells, and off the spine", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    expect(stamp.grass.length).toBeGreaterThan(0);
    const occupied = new Set<string>();
    for (const [x, z] of [...stamp.water, ...stamp.swamp, ...stamp.gaps]) occupied.add(`${x},${z}`);
    const seen = new Set<string>();
    for (const [x, z] of stamp.grass) {
      expect(x >= -1 && x <= 1 && z >= -8 && z <= 1).toBe(false);
      expect(occupied.has(`${x},${z}`)).toBe(false);
      expect(seen.has(`${x},${z}`)).toBe(false);
      seen.add(`${x},${z}`);
    }
  });

  it("keeps wet cells off the spine, off gap rims, and off each other", () => {
    const stamp = generateBlank(BLANK_STAMP_SEED);
    const wet = [...stamp.water, ...stamp.swamp];
    expect(wet.length).toBeGreaterThan(0);
    const gapSet = new Set(stamp.gaps.map(([x, z]) => `${x},${z}`));
    const seen = new Set<string>();
    for (const [x, z] of wet) {
      expect(x >= -1 && x <= 1 && z >= -8 && z <= 1).toBe(false);
      expect(seen.has(`${x},${z}`)).toBe(false);
      seen.add(`${x},${z}`);
      for (let dz = -2; dz <= 2; dz++) {
        for (let dx = -2; dx <= 2; dx++) {
          expect(gapSet.has(`${x + dx},${z + dz}`)).toBe(false);
        }
      }
    }
  });

  it("stays a legal bake across many seeds", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const stamp = generateBlank(seed);
      for (const [, , peak] of stamp.hills) {
        expect(peak).toBeLessThanOrEqual(TERRAIN_FILLER_PEAK_MAX);
      }
      const gapSet = new Set(stamp.gaps.map(([x, z]) => `${x},${z}`));
      for (const [x, z] of [...stamp.water, ...stamp.swamp]) {
        expect(gapSet.has(`${x},${z}`)).toBe(false);
      }
    }
  });
});
