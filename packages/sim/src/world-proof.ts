import {
  DIR_E,
  DIR_N,
  DIR_S,
  DIR_W,
  I_FRAMES_TICKS,
  KILL_RANGE2,
  LEAP_CELLS,
  REGION_CHAMBER,
  TURRET_AIM_TICKS,
  TURRET_COOL_TICKS,
  TURRET_COUNT,
  TURRET_RANGE2,
} from "./constants";
import {
  HOSTILE_AIM_TICKS,
  HOSTILE_CONE_SCOUT,
  HOSTILE_CONE_SPIRE,
  HOSTILE_CONE_WATCH,
  HOSTILE_COOL_TICKS,
  HOSTILE_COUNT,
  HOSTILE_SITES,
  HOSTILE_SPIRE_AIM_TICKS,
  HOSTILE_TETRA,
  hostileAimTicks,
  hostileRange2,
  tetraSkipDir,
} from "./hostiles";
import { canLeapDir, canRollTo } from "./movement";
import { DOWN, rollTowardDir } from "./orientation";
import type { ProofLine } from "./orientation-group";
import {
  DOOR,
  GLYPH,
  ICE_GLYPH,
  NPC,
  SHRINE,
  SLICE_RESERVE,
  SOCKET,
  START,
  TURRET_SITES,
  ZIG_SOCKET,
  occupied,
  regionOf,
  stampSlice,
} from "./slice";
import { Terrain } from "./terrain";
import { World } from "./world";

const DIRS4 = [DIR_E, DIR_W, DIR_N, DIR_S] as const;
const X0 = -18;
const Z0 = -34;
const X1 = 18;
const Z1 = 8;
const W = X1 - X0 + 1;
const D = Z1 - Z0 + 1;
const ORI = 24;
const STATES = W * D * ORI;
const INF = 0xffff;

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

function inBounds(x: number, z: number): boolean {
  return x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
}

function pack(x: number, z: number, o: number): number {
  return ((z - Z0) * W + (x - X0)) * ORI + o;
}

function bfs(
  world: World,
  sx: number,
  sz: number,
  so: number,
  leaps: boolean,
  pivots: boolean,
): Uint16Array {
  const dist = new Uint16Array(STATES);
  dist.fill(INF);
  const qx = new Int16Array(STATES);
  const qz = new Int16Array(STATES);
  const qo = new Uint8Array(STATES);
  const start = pack(sx, sz, so);
  dist[start] = 0;
  qx[0] = sx;
  qz[0] = sz;
  qo[0] = so;
  let head = 0;
  let tail = 1;
  while (head < tail) {
    const x = qx[head] ?? 0;
    const z = qz[head] ?? 0;
    const o = qo[head] ?? 0;
    head += 1;
    const d = dist[pack(x, z, o)] ?? INF;
    for (const dir of DIRS4) {
      const dx = dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0;
      const dz = dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0;
      const tx = x + dx;
      const tz = z + dz;
      if (inBounds(tx, tz) && canRollTo(world.terrain, x, z, tx, tz) && !occupied(world, tx, tz)) {
        const no = rollTowardDir(o, dir);
        const id = pack(tx, tz, no);
        const nd = d + 1;
        if (nd < (dist[id] ?? INF)) {
          dist[id] = nd;
          qx[tail] = tx;
          qz[tail] = tz;
          qo[tail] = no;
          tail += 1;
        }
      }
      if (leaps && canLeapDir(world.terrain, x, z, dir)) {
        const mx = x + dx;
        const mz = z + dz;
        const ex = x + dx * LEAP_CELLS;
        const ez = z + dz * LEAP_CELLS;
        if (inBounds(ex, ez) && !occupied(world, mx, mz) && !occupied(world, ex, ez)) {
          const no = rollTowardDir(rollTowardDir(o, dir), dir);
          const id = pack(ex, ez, no);
          const nd = d + 2;
          if (nd < (dist[id] ?? INF)) {
            dist[id] = nd;
            qx[tail] = ex;
            qz[tail] = ez;
            qo[tail] = no;
            tail += 1;
          }
        }
      }
      if (pivots) {
        const no = rollTowardDir(o, dir);
        const id = pack(x, z, no);
        const nd = d + 1;
        if (nd < (dist[id] ?? INF)) {
          dist[id] = nd;
          qx[tail] = x;
          qz[tail] = z;
          qo[tail] = no;
          tail += 1;
        }
      }
    }
  }
  return dist;
}

function minAt(dist: Uint16Array, x: number, z: number, pred?: (o: number) => boolean): number {
  let best = INF;
  for (let o = 0; o < ORI; o++) {
    if (pred && !pred(o)) continue;
    const d = dist[pack(x, z, o)] ?? INF;
    if (d < best) best = d;
  }
  return best;
}

function specials(): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [
    [START.x, START.z],
    [SHRINE.x, SHRINE.z],
    [SOCKET.x, SOCKET.z],
    [DOOR.x, DOOR.z],
    [GLYPH.x, GLYPH.z],
    [NPC.x, NPC.z],
  ];
  for (const site of TURRET_SITES) out.push(site);
  for (let x = -7; x <= 7; x++) out.push([x, -12]);
  return out;
}

function airOk(terrain: Terrain, sx: number, sz: number): boolean {
  if (terrain.height(sx, sz) !== 0) return false;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      if (dx === 0 && dz === 0) continue;
      if (terrain.height(sx + dx, sz + dz) !== 0) return false;
    }
  }
  return true;
}

function leaveCross(
  world: World,
  x: number,
  z: number,
  cells: Array<readonly [number, number]>,
): boolean {
  const inSet = (cx: number, cz: number): boolean => {
    for (const c of cells) if (c[0] === cx && c[1] === cz) return true;
    return false;
  };
  if (!inSet(x, z)) return true;
  const q: Array<[number, number, number]> = [[x, z, 0]];
  const seen = new Set<string>([`${x},${z}`]);
  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (!cur) continue;
    const [cx, cz, depth] = cur;
    if (depth >= 2) continue;
    for (const dir of DIRS4) {
      const dx = dir === DIR_E ? 1 : dir === DIR_W ? -1 : 0;
      const dz = dir === DIR_N ? -1 : dir === DIR_S ? 1 : 0;
      const nx = cx + dx;
      const nz = cz + dz;
      if (!canRollTo(world.terrain, cx, cz, nx, nz) || occupied(world, nx, nz)) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (!inSet(nx, nz)) return true;
      q.push([nx, nz, depth + 1]);
    }
  }
  return false;
}

export function proveWorld(): ProofLine[] {
  const lines: ProofLine[] = [];
  const world = new World({ seed: 1, contentHash: 1, slice: true });

  let offColumn = true;
  for (const [x] of TURRET_SITES) if (x === 0) offColumn = false;
  log(lines, offColumn, "sentries never occupy the socket column x=0");
  log(
    lines,
    TURRET_SITES.length === TURRET_COUNT,
    `gauntlet has ${TURRET_SITES.length} sentries (want ${TURRET_COUNT})`,
  );
  log(
    lines,
    TURRET_COOL_TICKS > I_FRAMES_TICKS,
    `sentry cooldown ${TURRET_COOL_TICKS} > i-frames ${I_FRAMES_TICKS}`,
  );
  log(
    lines,
    TURRET_AIM_TICKS > 2 * 24,
    `sentry windup ${TURRET_AIM_TICKS} ticks covers ≥ 2 rolls plus reading time`,
  );

  const fromStart = bfs(world, START.x, START.z, 0, true, true);
  const shrineD = minAt(fromStart, SHRINE.x, SHRINE.z);
  const socketClosed = minAt(fromStart, SOCKET.x, SOCKET.z);
  log(lines, shrineD === 7, `start → shrine in ${shrineD} moves`);
  log(lines, socketClosed === 20, `start → socket (door sealed) in ${socketClosed} moves`);

  world.doorOpen = 1;
  const fromSocket = bfs(world, SOCKET.x, SOCKET.z, 0, true, true);
  const glyphD = minAt(fromSocket, GLYPH.x, GLYPH.z);
  log(lines, glyphD === 5, `socket → glyph with door open in ${glyphD} moves`);
  const iceX: number = ICE_GLYPH.x;
  const iceZ: number = ICE_GLYPH.z;
  const glyphX: number = GLYPH.x;
  const glyphZ: number = GLYPH.z;
  log(
    lines,
    regionOf(iceX, iceZ, 1) === REGION_CHAMBER && (iceX !== glyphX || iceZ !== glyphZ),
    "ice glyph is inside the chamber and off the lightning cell",
  );
  world.doorOpen = 0;

  let arrive = INF;
  let solve = INF;
  for (let o = 0; o < ORI; o++) {
    const toShrine = fromStart[pack(SHRINE.x, SHRINE.z, o)] ?? INF;
    if (toShrine >= INF) continue;
    const fireFace = DOWN(o);
    const onward = bfs(world, SHRINE.x, SHRINE.z, o, true, false);
    const a = minAt(onward, SOCKET.x, SOCKET.z);
    const s = minAt(onward, SOCKET.x, SOCKET.z, (ori) => DOWN(ori) === fireFace);
    if (a < arrive) arrive = a;
    if (s < solve) solve = s;
  }
  log(
    lines,
    arrive === 13 && solve === 15,
    `socket fire-down ${solve} vs arrive ${arrive} (want 15 vs 13)`,
  );

  const leapPath = bfs(world, SHRINE.x, SHRINE.z, 0, true, false);
  const rollPath = bfs(world, SHRINE.x, SHRINE.z, 0, false, false);
  const leapCost = minAt(leapPath, SOCKET.x, SOCKET.z);
  const rollCost = minAt(rollPath, SOCKET.x, SOCKET.z);
  log(
    lines,
    leapCost === 13 && rollCost === 29,
    `chasm: roll-only ${rollCost} vs leap ${leapCost} shrine → socket (want 29 vs 13)`,
  );

  const npcWorld = new World({ seed: 1, contentHash: 1, slice: true });
  npcWorld.npcOn = 0;
  const noNpc = bfs(npcWorld, START.x, START.z, 0, true, true);
  log(
    lines,
    minAt(fromStart, SHRINE.x, SHRINE.z) === minAt(noNpc, SHRINE.x, SHRINE.z) &&
      minAt(fromStart, SOCKET.x, SOCKET.z) === minAt(noNpc, SOCKET.x, SOCKET.z),
    "Keeper occupancy does not change start → shrine or start → socket cost",
  );

  log(lines, regionOf(0, 0, 0) === 0, "origin is THE BLANK");
  log(lines, regionOf(0, -12, 0) === 1, "chasm rim is THE GAUNTLET");
  log(lines, regionOf(0, -22, 0) !== REGION_CHAMBER, "chamber title is gated by the door");
  log(lines, regionOf(0, -22, 1) === REGION_CHAMBER, "doorway belongs to THE SEALED CHAMBER");
  log(lines, regionOf(3, -24, 1) !== REGION_CHAMBER, "monolith exterior is not the chamber");

  let air = true;
  const terrain = new Terrain();
  stampSlice(terrain);
  for (const [x, z] of specials()) {
    if (!airOk(terrain, x, z)) air = false;
  }
  log(lines, air, "specials and their 1-cell rims sit at height 0 (leap rims stay flat)");

  let maxKills = 0;
  let someTwo = false;
  for (let x = X0; x <= X1; x++) {
    for (let z = Z0; z <= Z1; z++) {
      if (occupied(world, x, z) || world.terrain.isGap(x, z)) continue;
      let n = 0;
      for (const [tx, tz] of TURRET_SITES) {
        const dx = x - tx;
        const dz = z - tz;
        if (dx * dx + dz * dz <= KILL_RANGE2) n += 1;
      }
      if (n > maxKills) maxKills = n;
      if (n === 2) someTwo = true;
    }
  }
  log(
    lines,
    maxKills >= 2 && maxKills < TURRET_COUNT && someTwo,
    `one fire blast kills at most ${maxKills} (want ≥2, never all ${TURRET_COUNT})`,
  );

  let canEscape = true;
  let checked = 0;
  for (const [tx, tz] of TURRET_SITES) {
    for (let x = tx - 8; x <= tx + 8; x++) {
      for (let z = tz - 8; z <= tz + 8; z++) {
        const dx = x - tx;
        const dz = z - tz;
        if (dx * dx + dz * dz > TURRET_RANGE2) continue;
        if (occupied(world, x, z) || world.terrain.isGap(x, z)) continue;
        const cells: Array<readonly [number, number]> = [];
        const ox = [0, 1, -1, 0, 0];
        const oz = [0, 0, 0, 1, -1];
        for (let k = 0; k < 5; k++) {
          const cx = x + (ox[k] ?? 0);
          const cz = z + (oz[k] ?? 0);
          if (!occupied(world, cx, cz)) cells.push([cx, cz]);
        }
        for (const c of cells) {
          checked += 1;
          if (!leaveCross(world, c[0], c[1], cells)) canEscape = false;
        }
      }
    }
  }
  log(
    lines,
    canEscape && checked > 0,
    `every captured-cross cell escapes in ≤2 rolls (${checked} cells, windup ${TURRET_AIM_TICKS})`,
  );

  log(
    lines,
    HOSTILE_SITES.length === HOSTILE_COUNT && HOSTILE_COUNT > 20,
    `Blank hosts ${HOSTILE_COUNT} authored hostiles`,
  );
  log(
    lines,
    HOSTILE_AIM_TICKS > 2 * 24 &&
      HOSTILE_SPIRE_AIM_TICKS > HOSTILE_AIM_TICKS &&
      HOSTILE_COOL_TICKS > I_FRAMES_TICKS,
    `Blank windup ${HOSTILE_AIM_TICKS}/${HOSTILE_SPIRE_AIM_TICKS} covers ≥2 rolls; cool ${HOSTILE_COOL_TICKS} > i-frames`,
  );

  let kinds = 0;
  let opening = true;
  let columns = true;
  let unique = true;
  let walkable = true;
  let clearReserve = true;
  const seenH = new Set<string>();
  for (const [kind, x, z] of HOSTILE_SITES) {
    kinds |= 1 << kind;
    const adx = x < 0 ? -x : x;
    const adz = z < 0 ? -z : z;
    if ((adx > adz ? adx : adz) < 22) opening = false;
    if (x === START.x || x === ZIG_SOCKET.x) columns = false;
    if (
      x >= SLICE_RESERVE.x0 &&
      x <= SLICE_RESERVE.x1 &&
      z >= SLICE_RESERVE.z0 &&
      z <= SLICE_RESERVE.z1
    ) {
      clearReserve = false;
    }
    const key = `${x},${z}`;
    if (seenH.has(key)) unique = false;
    seenH.add(key);
    if (world.terrain.isWall(x, z) || world.terrain.isGap(x, z)) walkable = false;
    if (hostileAimTicks(kind) <= 2 * 24) clearReserve = false;
    if (kind === HOSTILE_TETRA) {
      const skip = tetraSkipDir(x, z);
      if (skip < 1 || skip > 4) walkable = false;
    }
  }
  log(
    lines,
    (kinds & 15) === 15,
    "Blank hostiles include scout, watch, spire, and tetra grammars",
  );
  log(lines, opening && unique && columns, "opening air stays clear; no socket columns; unique cells");
  log(lines, walkable && clearReserve, "every hostile sits on walkable ground outside the reserve");
  log(
    lines,
    hostileRange2(HOSTILE_CONE_WATCH) > hostileRange2(HOSTILE_CONE_SCOUT) &&
      hostileRange2(HOSTILE_CONE_SPIRE) > hostileRange2(HOSTILE_CONE_WATCH) &&
      hostileRange2(HOSTILE_TETRA) < hostileRange2(HOSTILE_CONE_SCOUT),
    "difficulty is range and grammar, not hit points",
  );

  let maxHKills = 0;
  for (let i = 0; i < HOSTILE_SITES.length; i++) {
    const a = HOSTILE_SITES[i];
    if (!a) continue;
    let n = 0;
    for (let j = 0; j < HOSTILE_SITES.length; j++) {
      const b = HOSTILE_SITES[j];
      if (!b) continue;
      const dx = a[1] - b[1];
      const dz = a[2] - b[2];
      if (dx * dx + dz * dz <= KILL_RANGE2) n += 1;
    }
    if (n > maxHKills) maxHKills = n;
  }
  log(
    lines,
    maxHKills === 1,
    `one fire blast cracks at most ${maxHKills} Blank hostile (want 1 — each kill is earned)`,
  );

  const first = HOSTILE_SITES[0];
  log(
    lines,
    first?.[0] === HOSTILE_CONE_SCOUT && first?.[1] === 28 && first?.[2] === 8,
    "first contact is the east scout, not a watch or spire",
  );

  return lines;
}

export function assertWorld(): void {
  const failed = proveWorld().filter((line) => !line.ok);
  if (failed.length) throw new Error(failed.map((line) => line.message).join("\n"));
}
