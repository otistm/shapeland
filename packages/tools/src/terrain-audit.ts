/**
 * Terrain audit. Reported by `npm run terrain:audit`; the CLI wrapper lives in
 * `terrain-audit-cli.ts` so this module stays free of `process` and can be imported by the browser
 * viewer and by tests.
 *
 * Answers the questions a level designer actually asks of a bake, in the terms the discipline uses:
 * how tall, how much of it is raised (the render budget), is anything stranded, and does the POI
 * cadence stay inside the 211-cell ceiling. Reads real heights through sim's own helpers, so it
 * cannot disagree with the game about what is walkable.
 */

import { Terrain as SimTerrain, type Terrain, canRollTo } from "@shapeland/sim";
import { planPois } from "./blank-plan";
import { type TerrainStamp, applyBlankStamp } from "./terrain-gen";

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export interface TerrainAudit {
  raised: number;
  maxHeight: number;
  perHeight: ReadonlyMap<number, number>;
  strandedCells: number;
  reachable: number;
  unreachableBenchTops: number;
  unreachableHills: number;
  unreachableWater: number;
  unreachableGrass: number;
  unreachablePois: string[];
  poiGaps: Array<{ from: string; to: string; cells: number }>;
}

export function bakeTerrain(stamp: TerrainStamp): Terrain {
  const terrain = new SimTerrain();
  for (let x = -7; x <= 7; x++) terrain.setGap(x, -12);
  applyBlankStamp(terrain, stamp);
  return terrain;
}

/** One bounded flood over the floor plus a margin. Unbounded would walk flat ground forever. */
export function rollReachable(terrain: Terrain, bound: number): Set<string> {
  const seen = new Set<string>(["0,0"]);
  const queue: Array<readonly [number, number]> = [[0, 0]];
  for (let i = 0; i < queue.length; i++) {
    const cur = queue[i];
    if (!cur) continue;
    const [x, z] = cur;
    for (const [dx, dz] of DIRS) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < -bound || nx > bound || nz < -bound || nz > bound) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      if (!canRollTo(terrain, x, z, nx, nz)) continue;
      seen.add(key);
      queue.push([nx, nz]);
    }
  }
  return seen;
}

export function auditTerrain(stamp: TerrainStamp): TerrainAudit {
  const terrain = bakeTerrain(stamp);
  const perHeight = new Map<number, number>();
  let raised = 0;
  let maxHeight = 0;
  terrain.forEachHeight((_x, _z, h) => {
    if (h <= 0) return;
    raised += 1;
    if (h > maxHeight) maxHeight = h;
    perHeight.set(h, (perHeight.get(h) ?? 0) + 1);
  });

  let strandedCells = 0;
  terrain.forEachHeight((x, z, h) => {
    if (h <= 0) return;
    let stair = false;
    for (const [dx, dz] of DIRS) {
      const dh = terrain.height(x + dx, z + dz) - h;
      if (dh <= 1 && dh >= -1) stair = true;
    }
    if (!stair) strandedCells += 1;
  });

  const seen = rollReachable(terrain, 164);
  const missing = (x: number, z: number) => !seen.has(`${x},${z}`);
  let unreachableBenchTops = 0;
  for (const b of stamp.benches) if (missing(b.cx, b.cz)) unreachableBenchTops += 1;
  let unreachableHills = 0;
  for (const [x, z] of stamp.hills) if (missing(x, z)) unreachableHills += 1;
  let unreachableWater = 0;
  for (const [x, z] of stamp.water) if (missing(x, z)) unreachableWater += 1;
  let unreachableGrass = 0;
  for (const [x, z] of stamp.grass) if (missing(x, z)) unreachableGrass += 1;

  const pois = planPois();
  const unreachablePois = pois.filter((p) => missing(p.x, p.z)).map((p) => p.name);

  // Nearest-neighbour chain from start: how far a player commits between committable places.
  const poiGaps: Array<{ from: string; to: string; cells: number }> = [];
  const left = [...pois];
  let cx = 0;
  let cz = 0;
  let fromName = "START";
  while (left.length) {
    let bestIdx = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < left.length; i++) {
      const p = left[i];
      if (!p) continue;
      const d = Math.abs(p.x - cx) + Math.abs(p.z - cz);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = left.splice(bestIdx, 1)[0];
    if (!next) break;
    poiGaps.push({ from: fromName, to: next.name, cells: bestDist });
    cx = next.x;
    cz = next.z;
    fromName = next.name;
  }

  return {
    raised,
    maxHeight,
    perHeight,
    strandedCells,
    reachable: seen.size,
    unreachableBenchTops,
    unreachableHills,
    unreachableWater,
    unreachableGrass,
    unreachablePois,
    poiGaps,
  };
}
