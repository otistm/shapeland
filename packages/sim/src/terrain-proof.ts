import { BLANK_BENCHES, BLANK_HILLS, BLANK_POIS, BLANK_POOLS } from "./blank-stamp";
import {
  BLANK_X0,
  BLANK_X1,
  BLANK_Z0,
  BLANK_Z1,
  BUTTON_E,
  BUTTON_JUMP,
  CLIFF_DELTA,
  DIR_E,
  DIR_N,
  DIR_S,
  DIR_W,
  FLAG_REFUSE,
  GRASS_ROLL_TICKS,
  LEAP_CELLS,
  MODE_CROUCH,
  MODE_IDLE,
  MODE_ROLL,
  STRUCTURE_PEAK_MAX,
  SWAMP_ROLL_TICKS,
  TERRAIN_PEAK_MAX,
} from "./constants";
import { canLeapDir, canRollTo } from "./movement";
import { DOWN, rollTowardDir } from "./orientation";
import type { ProofLine } from "./orientation-group";
import { SLICE_HILLS, ZIG_SOCKET, occupied, stampSlice } from "./slice";
import { Terrain, bench, poolFloor, terraceHill, terracePool } from "./terrain";
import { World } from "./world";

const DIRS4 = [DIR_E, DIR_W, DIR_N, DIR_S] as const;

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

function cheb(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx < 0 ? bx - ax : ax - bx;
  const dz = az - bz < 0 ? bz - az : az - bz;
  return dx > dz ? dx : dz;
}

function noPits(terrain: Terrain): boolean {
  let ok = true;
  terrain.forEachHeight((x, z, h) => {
    if (h <= 0) return;
    if (terrain.isWall(x, z)) return;
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

/**
 * One bounded flood over the floor AABB. Per-summit BFS on 320² would walk the same lattice
 * hundreds of times; an unbounded flood on height-0 never terminates if the target is a pit.
 */
function floorReachable(world: World): Set<string> {
  const x0 = BLANK_X0 - 4;
  const x1 = BLANK_X1 + 4;
  const z0 = BLANK_Z0 - 4;
  const z1 = BLANK_Z1 + 4;
  const seen = new Set<string>(["0,0"]);
  const q: Array<[number, number]> = [[0, 0]];
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (!cur) continue;
    const [x, z] = cur;
    for (const dir of DIRS4) {
      const nx = x + (dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0);
      const nz = z + (dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0);
      if (nx < x0 || nx > x1 || nz < z0 || nz > z1) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      if (!canRollTo(world.terrain, x, z, nx, nz) || occupied(world, nx, nz)) continue;
      seen.add(key);
      q.push([nx, nz]);
    }
  }
  return seen;
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
  terraceHill(over, 0, 0, TERRAIN_PEAK_MAX + 4);
  log(
    lines,
    over.height(0, 0) === TERRAIN_PEAK_MAX,
    `terraceHill clamps peak to ${TERRAIN_PEAK_MAX}`,
  );

  // A tall form is broad because a 1:1 apron from the summit costs one cell of run per unit. That
  // is the price of "a slope is a staircase", and it is what keeps a height-8 landmark climbable.
  const tall = new Terrain();
  bench(tall, 0, 0, 2, 2, TERRAIN_PEAK_MAX, 1);
  let apron = true;
  for (let r = 0; r <= TERRAIN_PEAK_MAX; r++) {
    const want = r <= 2 ? TERRAIN_PEAK_MAX : TERRAIN_PEAK_MAX - (r - 2);
    if (tall.height(r, 0) !== (want < 0 ? 0 : want)) apron = false;
  }
  log(lines, apron, `a bench apron steps down 1 per cell from ${TERRAIN_PEAK_MAX} to flat`);
  log(
    lines,
    tall.height(2, 2) === TERRAIN_PEAK_MAX && tall.height(3, 3) === TERRAIN_PEAK_MAX - 1,
    "a bench top is flat and its corner steps once",
  );

  const grand = new Terrain();
  bench(grand, 0, 0, 0, 0, 4, 3);
  log(
    lines,
    grand.height(1, 0) === 3 && grand.height(3, 0) === 3 && grand.height(4, 0) === 2,
    "tread 3 holds each terrace for 3 cells (processional slope)",
  );

  const basin = new Terrain();
  terracePool(basin, 0, 0, 5, 5, 6, 3);
  const floor = poolFloor(0, 0, 5, 5, 6, 3);
  log(
    lines,
    basin.height(0, 0) === floor.h && floor.h === 3,
    "terracePool floor sits steps below its rim",
  );
  log(
    lines,
    canRollTo(basin, 0, 0, 1, 0) && canRollTo(basin, 1, 0, 0, 0),
    "a stepped basin is exitable both ways — a pool, never a pit",
  );
  log(lines, noPits(basin), "every ring of a terracePool has a ±1 staircase neighbor");

  const slice = new Terrain();
  stampSlice(slice);
  log(lines, noPits(slice), "every raised cell on the slice has a ±1 staircase neighbor");
  let peaksInRange = true;
  slice.forEachHeight((_x, _z, h) => {
    if (h < 0 || h > TERRAIN_PEAK_MAX) peaksInRange = false;
  });
  log(lines, peaksInRange, `every stamped height is an integer in 0..${TERRAIN_PEAK_MAX}`);

  const world = new World({ seed: 1, contentHash: 1, slice: true });
  // Occupants are a component query, not the floor. The flood measures terrain.
  world.hostileAlive.fill(0);
  const reachable = floorReachable(world);
  let summits = true;
  for (const [cx, cz] of [...SLICE_HILLS, ...BLANK_HILLS]) {
    if (!reachable.has(`${cx},${cz}`)) summits = false;
  }
  log(lines, summits, "every terraceHill summit is roll-reachable from start");
  let benchTops = true;
  for (const [cx, cz] of BLANK_BENCHES) {
    if (world.terrain.isWall(cx, cz)) continue;
    if (!reachable.has(`${cx},${cz}`)) benchTops = false;
  }
  log(lines, benchTops, `all ${BLANK_BENCHES.length} bench tops are roll-reachable from start`);
  let poolFloors = true;
  for (const [cx, cz] of BLANK_POOLS) {
    if (!reachable.has(`${cx},${cz}`)) poolFloors = false;
  }
  log(lines, poolFloors, `all ${BLANK_POOLS.length} pool floors are roll-reachable from start`);
  let poisReachable = true;
  for (const poi of BLANK_POIS) {
    if (!reachable.has(`${poi.x},${poi.z}`)) poisReachable = false;
  }
  log(
    lines,
    BLANK_POIS.length > 0 && poisReachable,
    `all ${BLANK_POIS.length} named places are roll-reachable from start`,
  );

  let pierN = 0;
  let piersLegal = true;
  world.terrain.forEachWall((x, z, h) => {
    if (h < 1) return;
    pierN += 1;
    if (h > STRUCTURE_PEAK_MAX) piersLegal = false;
    if (world.terrain.height(x, z) > TERRAIN_PEAK_MAX) piersLegal = false;
  });
  log(
    lines,
    pierN > 0 && piersLegal,
    `${pierN} structure piers, visual ≤${STRUCTURE_PEAK_MAX}, walkable height still ≤${TERRAIN_PEAK_MAX}`,
  );

  const kinds = new Terrain();
  kinds.setWater(2, 0);
  kinds.setSwamp(2, 0);
  log(lines, kinds.isSwamp(2, 0) && !kinds.isWater(2, 0), "water and swamp are mutually exclusive");
  kinds.setGrass(2, 0);
  log(lines, kinds.isGrass(2, 0) && !kinds.isSwamp(2, 0), "grass replaces swamp on the same cell");
  kinds.setGap(2, 0);
  log(lines, kinds.isGap(2, 0) && !kinds.isGrass(2, 0), "a gap clears grass");
  kinds.setGrass(2, 0);
  log(lines, !kinds.isGrass(2, 0), "grass cannot occupy a gap");
  const wetFloor = new Terrain();
  wetFloor.setWater(1, 0);
  log(lines, canRollTo(wetFloor, 0, 0, 1, 0), "water is walkable floor, not a wall");
  const wet = new World({ seed: 1, contentHash: 1 });
  wet.terrain.setWater(0, 0);
  wet.step(BUTTON_JUMP);
  log(
    lines,
    wet.mode === MODE_IDLE && (wet.flags & FLAG_REFUSE) !== 0,
    "water refuses jump (wet footing)",
  );
  const bog = new World({ seed: 1, contentHash: 1 });
  bog.terrain.setSwamp(1, 0);
  bog.step(BUTTON_E);
  log(
    lines,
    bog.mode === MODE_ROLL && bog.duration === SWAMP_ROLL_TICKS,
    "swamp rolls cost SWAMP_ROLL_TICKS",
  );
  const meadow = new World({ seed: 1, contentHash: 1 });
  meadow.terrain.setGrass(1, 0);
  meadow.step(BUTTON_E);
  log(
    lines,
    meadow.mode === MODE_ROLL && meadow.duration === GRASS_ROLL_TICKS,
    "grass rolls cost GRASS_ROLL_TICKS",
  );
  const turf = new World({ seed: 1, contentHash: 1 });
  turf.terrain.setGrass(0, 0);
  turf.step(BUTTON_JUMP);
  log(lines, turf.mode === MODE_CROUCH, "grass still allows jump");

  let wetCells = 0;
  let wetReachable = true;
  let dryRims = true;
  const checkWet = (x: number, z: number) => {
    wetCells += 1;
    if (!reachable.has(`${x},${z}`)) wetReachable = false;
    slice.forEachGap((gx, gz) => {
      if (cheb(x, z, gx, gz) < 2) dryRims = false;
    });
  };
  slice.forEachWater(checkWet);
  slice.forEachSwamp(checkWet);
  log(
    lines,
    wetCells > 0 && wetReachable,
    `all ${wetCells} wet cells are roll-reachable from start`,
  );
  log(lines, dryRims, "no wet cell sits on a gap rim (water refuses jump, so leap pads stay dry)");
  let grassCells = 0;
  let grassReachable = true;
  slice.forEachGrass((x, z) => {
    grassCells += 1;
    if (!reachable.has(`${x},${z}`)) grassReachable = false;
  });
  log(
    lines,
    grassCells > 0 && grassReachable,
    `all ${grassCells} grass cells are roll-reachable from start`,
  );

  const zig = proveZigSocket(world);
  for (const line of zig) lines.push(line);

  return lines;
}

function proveZigSocket(world: World): ProofLine[] {
  const lines: ProofLine[] = [];
  // Window around the ziggurat apron, not the whole floor.
  const x0 = ZIG_SOCKET.x - 22;
  const x1 = ZIG_SOCKET.x + 22;
  const z0 = ZIG_SOCKET.z - 28;
  const z1 = ZIG_SOCKET.z + 28;
  const w = x1 - x0 + 1;
  const ori = 24;
  const states = w * (z1 - z0 + 1) * ori;
  const inf = 0xffff;
  const pack = (x: number, z: number, o: number) => ((z - z0) * w + (x - x0)) * ori + o;
  const dist = new Uint16Array(states);
  dist.fill(inf);
  const qx = new Int16Array(states);
  const qz = new Int16Array(states);
  const qo = new Uint8Array(states);
  const sx = -56;
  const sz = 144;
  const start = pack(sx, sz, 0);
  dist[start] = 0;
  qx[0] = sx;
  qz[0] = sz;
  qo[0] = 0;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const x = qx[head] ?? 0;
    const z = qz[head] ?? 0;
    const o = qo[head] ?? 0;
    const d = dist[pack(x, z, o)] ?? inf;
    head += 1;
    for (const dir of DIRS4) {
      const dx = dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0;
      const dz = dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0;
      const tx = x + dx;
      const tz = z + dz;
      if (tx >= x0 && tx <= x1 && tz >= z0 && tz <= z1) {
        if (canRollTo(world.terrain, x, z, tx, tz) && !occupied(world, tx, tz)) {
          const no = rollTowardDir(o, dir);
          const id = pack(tx, tz, no);
          const nd = d + 1;
          if (nd < (dist[id] ?? inf)) {
            dist[id] = nd;
            qx[tail] = tx;
            qz[tail] = tz;
            qo[tail] = no;
            tail += 1;
          }
        }
      }
      if (canLeapDir(world.terrain, x, z, dir)) {
        const mx = x + dx;
        const mz = z + dz;
        const ex = x + dx * LEAP_CELLS;
        const ez = z + dz * LEAP_CELLS;
        if (ex >= x0 && ex <= x1 && ez >= z0 && ez <= z1 && !occupied(world, mx, mz) && !occupied(world, ex, ez)) {
          const no = rollTowardDir(rollTowardDir(o, dir), dir);
          const id = pack(ex, ez, no);
          const nd = d + 2;
          if (nd < (dist[id] ?? inf)) {
            dist[id] = nd;
            qx[tail] = ex;
            qz[tail] = ez;
            qo[tail] = no;
            tail += 1;
          }
        }
      }
      const po = rollTowardDir(o, dir);
      const pid = pack(x, z, po);
      const pd = d + 1;
      if (pd < (dist[pid] ?? inf)) {
        dist[pid] = pd;
        qx[tail] = x;
        qz[tail] = z;
        qo[tail] = po;
        tail += 1;
      }
    }
  }
  const fireFace = DOWN(0);
  let arrive = inf;
  let solve = inf;
  for (let o = 0; o < ori; o++) {
    const d = dist[pack(ZIG_SOCKET.x, ZIG_SOCKET.z, o)] ?? inf;
    if (d < arrive) arrive = d;
    if (DOWN(o) === fireFace && d < solve) solve = d;
  }
  log(lines, arrive < inf, `ziggurat summit is reachable from the south foot in ${arrive} moves`);
  log(
    lines,
    solve > arrive && solve <= arrive + 6,
    `ziggurat fire-down ${solve} vs arrive ${arrive} (want solve > arrive and ≤ arrive+6)`,
  );
  return lines;
}

export function assertTerrain(): void {
  const failed = proveTerrain().filter((line) => !line.ok);
  if (failed.length) throw new Error(failed.map((line) => line.message).join("\n"));
}
