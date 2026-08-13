import { CLIFF_DELTA, DIR_E, DIR_N, DIR_S, DIR_W, TERRAIN_PEAK_MAX } from "./constants";
import { canRollTo } from "./movement";
import type { ProofLine } from "./orientation-group";
import { SLICE_HILLS, occupied, stampSlice } from "./slice";
import { Terrain, terraceHill } from "./terrain";
import { World } from "./world";

const DIRS4 = [DIR_E, DIR_W, DIR_N, DIR_S] as const;

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

function noPits(terrain: Terrain): boolean {
  let ok = true;
  terrain.forEachHeight((x, z, h) => {
    if (h <= 0) return;
    let stair = false;
    for (const dir of DIRS4) {
      const nx = x + (dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0);
      const nz = z + (dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0);
      const dh = terrain.height(nx, nz) - h;
      if (dh <= 1 && dh >= -1) stair = true;
    }
    if (!stair) ok = false;
  });
  return ok;
}

function reachableCell(world: World, tx: number, tz: number): boolean {
  const seen = new Set<string>(["0,0"]);
  const q: Array<[number, number]> = [[0, 0]];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (!cur) continue;
    const [x, z] = cur;
    if (x === tx && z === tz) return true;
    for (const dir of DIRS4) {
      const nx = x + (dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0);
      const nz = z + (dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0);
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      if (!canRollTo(world.terrain, x, z, nx, nz) || occupied(world, nx, nz)) continue;
      seen.add(key);
      q.push([nx, nz]);
    }
  }
  return false;
}

export function proveTerrain(): ProofLine[] {
  const lines: ProofLine[] = [];
  const hill = new Terrain();
  terraceHill(hill, 0, 0, 3);
  log(lines, hill.height(0, 0) === 3, "terraceHill peak is the integer summit");
  log(lines, hill.height(1, 0) === 2 && hill.height(0, 1) === 2, "first Chebyshev ring is peak−1");
  log(
    lines,
    hill.height(2, 2) === 1 && hill.height(3, 0) === 0,
    "outer ring is a staircase onto flat",
  );
  log(lines, canRollTo(hill, 2, 0, 1, 0), "a ±1 terrace is a rollable stair");
  log(
    lines,
    !canRollTo(hill, 2, 0, 0, 0) && !canRollTo(hill, 0, 0, 2, 0),
    `a |Δh|≥${CLIFF_DELTA} cliff refuses rolls both ways`,
  );

  const over = new Terrain();
  terraceHill(over, 0, 0, 9);
  log(
    lines,
    over.height(0, 0) === TERRAIN_PEAK_MAX,
    `terraceHill clamps peak to ${TERRAIN_PEAK_MAX}`,
  );

  const slice = new Terrain();
  stampSlice(slice);
  log(lines, noPits(slice), "every raised cell on the slice has a ±1 staircase neighbor");

  const world = new World({ seed: 1, contentHash: 1, slice: true });
  let summits = true;
  for (const [cx, cz] of SLICE_HILLS) {
    if (!reachableCell(world, cx, cz)) summits = false;
  }
  log(lines, summits, "every terraceHill summit is roll-reachable from start");

  return lines;
}

export function assertTerrain(): void {
  const failed = proveTerrain().filter((line) => !line.ok);
  if (failed.length) throw new Error(failed.map((line) => line.message).join("\n"));
}
