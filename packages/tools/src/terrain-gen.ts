/**
 * Shapeland terrain generator.
 *
 * Landmarks are authored (`blank-plan.ts`); noise only dresses the ground between them. Form comes
 * from the sanctioned sim helpers — `bench`, `terracePool`, `terraceHill` — so integer heights,
 * ±1 staircases and roll-reachable summits hold by construction rather than by inspection.
 *
 * The generator stamps the plan into a real `Terrain` and then *queries* it when deciding where
 * gaps and surface kinds may go. That is deliberate: a tool that reimplements sim rules diverges
 * from them and then lies about the map.
 *
 * The bake covers the floor mesh, 320 × 320 = 102_400 cells. Not a 1000² analog heightmap.
 */

import {
  BLANK_X0,
  BLANK_X1,
  BLANK_Z0,
  BLANK_Z1,
  DOOR,
  GLYPH,
  ICE_GLYPH,
  NPC,
  SHRINE,
  SLICE_RESERVE,
  SOCKET,
  START,
  TERRAIN_FILLER_PEAK_MAX,
  TERRAIN_PEAK_MAX,
  TURRET_SITES,
  Terrain,
  bench,
  poolFloor,
  stampStructure,
  structureExtent,
  terraceHill,
  terracePool,
} from "@shapeland/sim";
import {
  type BenchSite,
  CAUSEWAY_FIELD,
  DELTA_FIELD,
  GRIKE_CANYONS,
  GRIKE_FIELD,
  type Poi,
  type PoolSite,
  planBenches,
  planPois,
  planPools,
  planStructures,
} from "./blank-plan";

export { BLANK_X0, BLANK_X1, BLANK_Z0, BLANK_Z1 };
export type { BenchSite, Poi, PoolSite };

export const BLANK_STAMP_SEED = 1;

export type Hill = readonly [number, number, number];
export type Cell = readonly [number, number];

export interface TerrainStamp {
  seed: number;
  benches: readonly BenchSite[];
  pools: readonly PoolSite[];
  hills: readonly Hill[];
  gaps: readonly Cell[];
  water: readonly Cell[];
  swamp: readonly Cell[];
  grass: readonly Cell[];
  /** `[x, z, h]` structure piers. Occupancy; h is visual height from y=0. */
  piers: readonly Hill[];
}

export const PINNED_BLANK_HILL: Hill = [7, -3, 3];

const SPECIALS: Cell[] = [
  [START.x, START.z],
  [SHRINE.x, SHRINE.z],
  [NPC.x, NPC.z],
  [SOCKET.x, SOCKET.z],
  [DOOR.x, DOOR.z],
  [GLYPH.x, GLYPH.z],
  [ICE_GLYPH.x, ICE_GLYPH.z],
];
for (const [x, z] of TURRET_SITES) SPECIALS.push([x, z]);
for (let x = -7; x <= 7; x++) SPECIALS.push([x, -12]);

const PUDDLE = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/** Safety valves so one seed cannot flood the instance sheets. Hash-rank, not north-west-first. */
const HILL_CAP = 72;
const GAP_CAP = 900;
const WATER_CAP = 2600;
const SWAMP_CAP = 900;
const GRASS_CAP = 3200;
const PIER_CAP = 800;

function cheb(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax - bx;
  const dz = az - bz;
  const adx = dx < 0 ? -dx : dx;
  const adz = dz < 0 ? -dz : dz;
  return adx > adz ? adx : adz;
}

interface Box {
  readonly x0: number;
  readonly x1: number;
  readonly z0: number;
  readonly z1: number;
}

function chebToBox(x: number, z: number, box: Box): number {
  const dx = x < box.x0 ? box.x0 - x : x > box.x1 ? x - box.x1 : 0;
  const dz = z < box.z0 ? box.z0 - z : z > box.z1 ? z - box.z1 : 0;
  return dx > dz ? dx : dz;
}

const SPINE: Box = { x0: -1, x1: 1, z0: -8, z1: 1 };

function inBounds(x: number, z: number): boolean {
  return x >= BLANK_X0 && x <= BLANK_X1 && z >= BLANK_Z0 && z <= BLANK_Z1;
}

function inReserve(x: number, z: number): boolean {
  return chebToBox(x, z, SLICE_RESERVE) === 0;
}

function onSpine(x: number, z: number): boolean {
  return chebToBox(x, z, SPINE) === 0;
}

function inField(x: number, z: number, f: Box): boolean {
  return x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1;
}

/** Integer mix. Tools may use Math.imul; sim still must not call unspecified Math. */
export function hash2(x: number, z: number, seed: number): number {
  let h = seed >>> 0;
  h = Math.imul(h ^ ((x | 0) + 0x9e3779b9), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ ((z | 0) + 0x165667b1), 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  return h >>> 0;
}

/** Ground a bench covers once its apron is drawn. */
export function benchExtent(b: BenchSite): Box {
  const top = b.top > TERRAIN_PEAK_MAX ? TERRAIN_PEAK_MAX : b.top | 0;
  const run = b.tread < 1 ? 1 : b.tread | 0;
  const grow = (top - 1) * run;
  const w = (b.halfW < 0 ? 0 : b.halfW | 0) + grow;
  const d = (b.halfD < 0 ? 0 : b.halfD | 0) + grow;
  return { x0: b.cx - w, x1: b.cx + w, z0: b.cz - d, z1: b.cz + d };
}

function poolAsBench(p: PoolSite): BenchSite {
  return { cx: p.cx, cz: p.cz, halfW: p.halfW, halfD: p.halfD, top: p.rimTop, tread: 1 };
}

function boxesOverlap(a: Box, b: Box): boolean {
  return a.x0 <= b.x1 && b.x0 <= a.x1 && a.z0 <= b.z1 && b.z0 <= a.z1;
}

/**
 * Reject an authored form with a message a designer can act on, rather than letting it surface later
 * as a failed socket pin.
 */
export function validatePlan(): string[] {
  const problems: string[] = [];
  const check = (label: string, box: Box) => {
    if (box.x0 < BLANK_X0 || box.x1 > BLANK_X1 || box.z0 < BLANK_Z0 || box.z1 > BLANK_Z1) {
      problems.push(
        `${label} runs off the floor mesh: x ${box.x0}..${box.x1}, z ${box.z0}..${box.z1}`,
      );
    }
    if (boxesOverlap(box, SLICE_RESERVE)) {
      problems.push(`${label} overlaps the gauntlet reserve; move it clear of SLICE_RESERVE`);
    }
    if (boxesOverlap(box, SPINE)) {
      problems.push(`${label} overlaps the shrine spine, which must stay flat`);
    }
    for (const [sx, sz] of SPECIALS) {
      if (chebToBox(sx, sz, box) < 2) {
        problems.push(`${label} comes within 2 cells of the special at (${sx}, ${sz})`);
      }
    }
  };
  for (const b of planBenches()) {
    if (b.top > TERRAIN_PEAK_MAX) {
      problems.push(`bench at (${b.cx}, ${b.cz}) has top ${b.top} above TERRAIN_PEAK_MAX`);
    }
    check(`bench at (${b.cx}, ${b.cz})`, benchExtent(b));
  }
  for (const p of planPools()) {
    check(`pool at (${p.cx}, ${p.cz})`, benchExtent(poolAsBench(p)));
  }
  for (const poi of planPois()) {
    if (!inBounds(poi.x, poi.z)) {
      problems.push(`POI ${poi.name} sits off the floor mesh at (${poi.x}, ${poi.z})`);
    }
    // A label inside the reserve names ground the player cannot stand on while the door is sealed.
    if (inReserve(poi.x, poi.z)) {
      problems.push(
        `POI ${poi.name} sits inside the gauntlet reserve at (${poi.x}, ${poi.z}); label it from ground the player can reach`,
      );
    }
  }
  const f = GRIKE_FIELD;
  const xStep = f.clint + 1;
  const channel0 = f.x0 + f.clint;
  for (const c of GRIKE_CANYONS) {
    if (c.x < f.x0 || c.x > f.x1 || c.z0 < f.z0 || c.z1 > f.z1) {
      problems.push(`grike canyon at x=${c.x} leaves GRIKE_FIELD`);
    }
    if ((c.x - channel0) % xStep !== 0) {
      problems.push(`grike canyon at x=${c.x} is not a clint channel`);
    }
  }
  for (const s of planStructures()) {
    check(`structure ${s.kind} at (${s.cx}, ${s.cz})`, structureExtent(s));
  }
  return problems;
}

/** Limestone pavement: clint blocks separated by grike channels, N–S grain dominant. */
function grikeBenches(): BenchSite[] {
  const out: BenchSite[] = [];
  const f = GRIKE_FIELD;
  const xStep = f.clint + 1;
  const zStep = f.course + 1;
  const hw = (f.clint - 1) >> 1;
  const hd = (f.course - 1) >> 1;
  for (let z = f.z0 + hd; z + hd <= f.z1; z += zStep) {
    for (let x = f.x0 + hw; x + hw <= f.x1; x += xStep) {
      out.push({ cx: x, cz: z, halfW: hw, halfD: hd, top: 1, tread: 1 });
    }
  }
  return out;
}

/**
 * Columnar field stepping down toward the south-east. Height comes from a monotone band index, so
 * neighbouring columns can never differ by more than one unit and the whole field stays rollable.
 */
function causewayBenches(): BenchSite[] {
  const out: BenchSite[] = [];
  const f = CAUSEWAY_FIELD;
  const spanX = f.x1 - f.x0;
  const spanZ = f.z1 - f.z0;
  for (let z = f.z0 + 1; z + 1 <= f.z1; z += 2) {
    for (let x = f.x0 + 1; x + 1 <= f.x1; x += 2) {
      const px = (x - f.x0) / spanX;
      const pz = (z - f.z0) / spanZ;
      const fall = (px + pz) * 0.5;
      const h = 4 - Math.floor(fall * 4);
      if (h < 1) continue;
      out.push({ cx: x, cz: z, halfW: 0, halfD: 0, top: h, tread: 1 });
    }
  }
  return out;
}

function stampForms(
  terrain: Terrain,
  benches: readonly BenchSite[],
  pools: readonly PoolSite[],
  hills: readonly Hill[],
): void {
  for (const b of benches) bench(terrain, b.cx, b.cz, b.halfW, b.halfD, b.top, b.tread);
  for (const p of pools) terracePool(terrain, p.cx, p.cz, p.halfW, p.halfD, p.rimTop, p.steps);
  for (const [cx, cz, peak] of hills) terraceHill(terrain, cx, cz, peak);
}

function hillSiteOk(terrain: Terrain, cx: number, cz: number, peak: number): boolean {
  if (peak < 1 || peak > TERRAIN_PEAK_MAX) return false;
  const box = benchExtent({ cx, cz, halfW: 0, halfD: 0, top: peak, tread: 1 });
  if (box.x0 < BLANK_X0 || box.x1 > BLANK_X1 || box.z0 < BLANK_Z0 || box.z1 > BLANK_Z1)
    return false;
  if (boxesOverlap(box, SLICE_RESERVE) || boxesOverlap(box, SPINE)) return false;
  for (const [sx, sz] of SPECIALS) {
    if (chebToBox(sx, sz, box) < 2) return false;
  }
  // Filler never lands on authored ground: it would refill a carved pool or blur a landmark.
  for (let x = box.x0; x <= box.x1; x++) {
    for (let z = box.z0; z <= box.z1; z++) {
      if (terrain.height(x, z) !== 0) return false;
      if (terrain.isWall(x, z)) return false;
    }
  }
  return true;
}

function hillOk(
  terrain: Terrain,
  cx: number,
  cz: number,
  peak: number,
  placed: readonly Hill[],
): boolean {
  if (!hillSiteOk(terrain, cx, cz, peak)) return false;
  for (const [px, pz, pp] of placed) {
    if (cheb(cx, cz, px, pz) < peak + pp) return false;
  }
  return true;
}

function sortHills(hills: Hill[], seed: number, salt: number): void {
  hills.sort((a, b) => {
    const ra = hash2(a[0], a[1], seed ^ salt);
    const rb = hash2(b[0], b[1], seed ^ salt);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
}

function sortCells(cells: Cell[], seed: number, salt: number): void {
  cells.sort((a, b) => {
    const ra = hash2(a[0], a[1], seed ^ salt);
    const rb = hash2(b[0], b[1], seed ^ salt);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (a[0] !== b[0]) return a[0] - b[0];
    return a[1] - b[1];
  });
}

function hasCell(cells: readonly Cell[], x: number, z: number): boolean {
  for (const [cx, cz] of cells) {
    if (cx === x && cz === z) return true;
  }
  return false;
}

/**
 * Gaps only ever open in flat ground. A gap cut into an apron could sever the one staircase to a
 * summit, and proving the absence of that per layout is far more expensive than forbidding it.
 */
function gapOk(
  terrain: Terrain,
  x: number,
  z: number,
  gaps: ReadonlySet<string>,
  spacing: number,
): boolean {
  if (!inBounds(x, z) || onSpine(x, z) || inReserve(x, z)) return false;
  if (terrain.height(x, z) !== 0) return false;
  if (terrain.isWall(x, z)) return false;
  if (inField(x, z, DELTA_FIELD)) return false;
  for (const [sx, sz] of SPECIALS) {
    if (cheb(x, z, sx, sz) < 2) return false;
  }
  for (let dz = -spacing; dz <= spacing; dz++) {
    for (let dx = -spacing; dx <= spacing; dx++) {
      if (dx === 0 && dz === 0) continue;
      if (gaps.has(`${x + dx},${z + dz}`)) return false;
    }
  }
  return true;
}

/** One-cell N–S canyon: Z-adjacent gaps are the grain; E–W neighbours would make a pit. */
function canyonGapOk(
  terrain: Terrain,
  x: number,
  z: number,
  gaps: ReadonlySet<string>,
): boolean {
  if (!gapOk(terrain, x, z, gaps, 0)) return false;
  if (gaps.has(`${x - 1},${z}`) || gaps.has(`${x + 1},${z}`)) return false;
  return true;
}

/**
 * Wet cells stay 2 clear of every gap: water refuses jump, so a wet gap rim could be the only
 * launch pad for a required leap. Cheaper to forbid than to prove safe per layout.
 */
function wetOk(
  x: number,
  z: number,
  gapSet: ReadonlySet<string>,
  taken: ReadonlySet<string>,
): boolean {
  if (!inBounds(x, z) || onSpine(x, z) || inReserve(x, z)) return false;
  if (taken.has(`${x},${z}`)) return false;
  for (const [sx, sz] of SPECIALS) {
    if (cheb(x, z, sx, sz) < 2) return false;
  }
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (gapSet.has(`${x + dx},${z + dz}`)) return false;
    }
  }
  return true;
}

/** Grass may sit beside a gap — jump still works from turf, so a grass rim is a legal leap pad. */
function grassOk(
  x: number,
  z: number,
  gapSet: ReadonlySet<string>,
  taken: ReadonlySet<string>,
): boolean {
  if (!inBounds(x, z) || onSpine(x, z) || inReserve(x, z)) return false;
  if (taken.has(`${x},${z}`) || gapSet.has(`${x},${z}`)) return false;
  for (const [sx, sz] of SPECIALS) {
    if (cheb(x, z, sx, sz) < 2) return false;
  }
  return true;
}

/**
 * Braided distributaries, after the Okavango. A course walks south with hash-driven lateral drift
 * rather than being a round puddle, because a delta reads as flow.
 */
function deltaChannels(seed: number): Cell[] {
  const out: Cell[] = [];
  const f = DELTA_FIELD;
  const heads = [-24, -4, 16, 38, 60, 78];
  for (let i = 0; i < heads.length; i++) {
    let x = heads[i] ?? 0;
    for (let z = f.z0; z <= f.z1; z++) {
      const drift = hash2(x, z, seed ^ (0x2000 + i)) % 5;
      if (drift === 0) x -= 1;
      else if (drift === 1) x += 1;
      if (x < f.x0) x = f.x0;
      if (x > f.x1) x = f.x1;
      const wide = hash2(x, z, seed ^ 0x2f) % 3 === 0 ? 1 : 0;
      for (let dx = -wide; dx <= wide; dx++) out.push([x + dx, z]);
    }
  }
  return out;
}

/**
 * Propose the bake. Authored landmarks, then noise-scattered filler and surface kinds around them.
 */
export function generateBlank(seed: number = BLANK_STAMP_SEED): TerrainStamp {
  const problems = validatePlan();
  if (problems.length) throw new Error(`terrain plan is invalid:\n  ${problems.join("\n  ")}`);

  const benches: BenchSite[] = [...planBenches(), ...grikeBenches(), ...causewayBenches()];
  const pools: PoolSite[] = [...planPools()];

  // Scratch terrain so every later rule reads real heights from sim's own helpers.
  const terrain = new Terrain();
  stampForms(terrain, benches, pools, []);
  for (const s of planStructures()) stampStructure(terrain, s);
  const piers: Hill[] = [];
  terrain.forEachWall((x, z, h) => {
    if (h < 1 || piers.length >= PIER_CAP) return;
    piers.push([x, z, h]);
  });

  const step = 4;
  const hillCandidates: Hill[] = [];
  for (let z = BLANK_Z0; z <= BLANK_Z1; z += step) {
    for (let x = BLANK_X0; x <= BLANK_X1; x += step) {
      if (x === PINNED_BLANK_HILL[0] && z === PINNED_BLANK_HILL[1]) continue;
      if (hash2(x, z, seed) % 100 >= 26) continue;
      const peak = 1 + (hash2(x, z, seed ^ 0xa5a5a5a5) % TERRAIN_FILLER_PEAK_MAX);
      if (!hillSiteOk(terrain, x, z, peak)) continue;
      hillCandidates.push([x, z, peak]);
    }
  }
  sortHills(hillCandidates, seed, 0x11);
  const hills: Hill[] = [PINNED_BLANK_HILL];
  for (const [x, z, peak] of hillCandidates) {
    if (hills.length >= HILL_CAP) break;
    if (!hillOk(terrain, x, z, peak, hills)) continue;
    hills.push([x, z, peak]);
  }
  stampForms(terrain, [], [], hills);

  // Grikes: the fissures between clints, N–S grain dominant, a minority opening into true gaps.
  const gaps: Cell[] = [];
  const gapSet = new Set<string>();
  const addGap = (x: number, z: number, spacing: number) => {
    if (gaps.length >= GAP_CAP) return;
    if (!gapOk(terrain, x, z, gapSet, spacing)) return;
    gaps.push([x, z]);
    gapSet.add(`${x},${z}`);
  };
  for (const c of GRIKE_CANYONS) {
    for (let z = c.z0; z <= c.z1; z++) {
      if (gaps.length >= GAP_CAP) break;
      if (!canyonGapOk(terrain, c.x, z, gapSet)) continue;
      gaps.push([c.x, z]);
      gapSet.add(`${c.x},${z}`);
    }
  }
  for (let z = GRIKE_FIELD.z0; z <= GRIKE_FIELD.z1; z++) {
    for (let x = GRIKE_FIELD.x0; x <= GRIKE_FIELD.x1; x++) {
      if (terrain.height(x, z) !== 0) continue;
      if (hash2(x, z, seed ^ 0x6b) % 6 !== 0) continue;
      addGap(x, z, 1);
    }
  }
  // Sparse on purpose. The pavement is the gap district; cracks out on the plain should read as
  // found rather than sprinkled, so this stays low enough not to become texture.
  const scatterGaps: Cell[] = [];
  for (let z = BLANK_Z0; z <= BLANK_Z1; z += step) {
    for (let x = BLANK_X0; x <= BLANK_X1; x += step) {
      if (hash2(x + 17, z - 9, seed) % 100 >= 3) continue;
      const gx = x + ((hash2(x, z, seed ^ 3) % 3) - 1);
      const gz = z + ((hash2(x, z, seed ^ 5) % 3) - 1);
      scatterGaps.push([gx, gz]);
    }
  }
  sortCells(scatterGaps, seed, 0x67);
  for (const [x, z] of scatterGaps) addGap(x, z, 2);

  // Water: pool floors first (they are the reason the pools exist), then the delta braid.
  const water: Cell[] = [];
  const taken = new Set<string>();
  const addWet = (into: Cell[], x: number, z: number, cap: number) => {
    if (into.length >= cap) return;
    if (terrain.isWall(x, z)) return;
    if (!wetOk(x, z, gapSet, taken)) return;
    into.push([x, z]);
    taken.add(`${x},${z}`);
  };
  for (const p of pools) {
    const floor = poolFloor(p.cx, p.cz, p.halfW, p.halfD, p.rimTop, p.steps);
    for (let x = floor.x0; x <= floor.x1; x++) {
      for (let z = floor.z0; z <= floor.z1; z++) addWet(water, x, z, WATER_CAP);
    }
  }
  for (const [x, z] of deltaChannels(seed)) {
    if (terrain.height(x, z) !== 0) continue;
    addWet(water, x, z, WATER_CAP);
  }
  const waterSet = new Set(water.map(([x, z]) => `${x},${z}`));

  // Swamp: the delta margins, i.e. ground that touches the braid but is not in it.
  const swampCandidates: Cell[] = [];
  for (let z = DELTA_FIELD.z0; z <= DELTA_FIELD.z1; z++) {
    for (let x = DELTA_FIELD.x0; x <= DELTA_FIELD.x1; x++) {
      if (waterSet.has(`${x},${z}`) || terrain.height(x, z) !== 0) continue;
      let touches = false;
      for (const [dx, dz] of PUDDLE) {
        if (dx === 0 && dz === 0) continue;
        if (waterSet.has(`${x + dx},${z + dz}`)) touches = true;
      }
      if (!touches) continue;
      if (hash2(x, z, seed ^ 0x73) % 3 === 0) swampCandidates.push([x, z]);
    }
  }
  sortCells(swampCandidates, seed, 0x73);
  const swamp: Cell[] = [];
  for (const [x, z] of swampCandidates) addWet(swamp, x, z, SWAMP_CAP);

  // Grass: Ifugao treads, delta island crowns, and the shaded floor of the grikes.
  const grass: Cell[] = [];
  const addGrass = (x: number, z: number) => {
    if (grass.length >= GRASS_CAP) return;
    if (terrain.isWall(x, z)) return;
    if (!grassOk(x, z, gapSet, taken)) return;
    grass.push([x, z]);
    taken.add(`${x},${z}`);
  };
  const treadFields = planBenches().filter((b) => b.tread > 1);
  for (const b of treadFields) {
    const box = benchExtent(b);
    for (let z = box.z0; z <= box.z1; z++) {
      for (let x = box.x0; x <= box.x1; x++) {
        if (terrain.height(x, z) < 1) continue;
        if (hash2(x, z, seed ^ 0x91) % 4 === 0) continue;
        addGrass(x, z);
      }
    }
  }
  for (const b of planBenches()) {
    if (b.tread > 1 || b.top > 2) continue;
    const box = benchExtent(b);
    for (let z = box.z0; z <= box.z1; z++) {
      for (let x = box.x0; x <= box.x1; x++) {
        if (terrain.height(x, z) < 1) continue;
        addGrass(x, z);
      }
    }
  }
  for (let z = GRIKE_FIELD.z0; z <= GRIKE_FIELD.z1; z++) {
    for (let x = GRIKE_FIELD.x0; x <= GRIKE_FIELD.x1; x++) {
      if (terrain.height(x, z) !== 0) continue;
      if (hash2(x, z, seed ^ 0xb1) % 3 !== 0) continue;
      addGrass(x, z);
    }
  }

  return { seed: seed >>> 0, benches, pools, hills, gaps, water, swamp, grass, piers };
}

export function stampBenches(terrain: Terrain, benches: readonly BenchSite[]): void {
  for (const b of benches) bench(terrain, b.cx, b.cz, b.halfW, b.halfD, b.top, b.tread);
}

export function stampPools(terrain: Terrain, pools: readonly PoolSite[]): void {
  for (const p of pools) terracePool(terrain, p.cx, p.cz, p.halfW, p.halfD, p.rimTop, p.steps);
}

export function stampHills(terrain: Terrain, hills: readonly Hill[]): void {
  for (const [cx, cz, peak] of hills) terraceHill(terrain, cx, cz, peak);
}

export function stampGaps(terrain: Terrain, gaps: readonly Cell[]): void {
  for (const [x, z] of gaps) terrain.setGap(x, z);
}

export function stampWater(terrain: Terrain, water: readonly Cell[]): void {
  for (const [x, z] of water) terrain.setWater(x, z);
}

export function stampSwamp(terrain: Terrain, swamp: readonly Cell[]): void {
  for (const [x, z] of swamp) terrain.setSwamp(x, z);
}

export function stampGrass(terrain: Terrain, grass: readonly Cell[]): void {
  for (const [x, z] of grass) terrain.setGrass(x, z);
}

export function stampPiers(terrain: Terrain, piers: readonly Hill[]): void {
  for (const [x, z, h] of piers) terrain.setPier(x, z, h);
}

export function applyBlankStamp(terrain: Terrain, stamp: TerrainStamp): void {
  stampBenches(terrain, stamp.benches);
  stampPools(terrain, stamp.pools);
  stampHills(terrain, stamp.hills);
  stampPiers(terrain, stamp.piers);
  stampGaps(terrain, stamp.gaps);
  stampWater(terrain, stamp.water);
  stampSwamp(terrain, stamp.swamp);
  stampGrass(terrain, stamp.grass);
}

export function stampToJson(stamp: TerrainStamp): string {
  return `${JSON.stringify(stamp, null, 2)}\n`;
}

function formatHill(h: Hill): string {
  return `  [${h[0]}, ${h[1]}, ${h[2]}],`;
}

function formatCell(c: Cell): string {
  return `  [${c[0]}, ${c[1]}],`;
}

function formatBench(b: BenchSite): string {
  return `  [${b.cx}, ${b.cz}, ${b.halfW}, ${b.halfD}, ${b.top}, ${b.tread}],`;
}

function formatPool(p: PoolSite): string {
  return `  [${p.cx}, ${p.cz}, ${p.halfW}, ${p.halfD}, ${p.rimTop}, ${p.steps}],`;
}

/** TypeScript module body for `packages/sim/src/blank-stamp.ts`. */
export function stampToTs(stamp: TerrainStamp): string {
  const pois = planPois()
    .map((p) => `  { name: "${p.name}", x: ${p.x}, z: ${p.z}, ref: "${p.ref}" },`)
    .join("\n");
  return `/** Committed bake of The Blank. Produced by \`generateBlank(BLANK_STAMP_SEED)\`. */

export const BLANK_STAMP_SEED = ${stamp.seed};

/** \`[cx, cz, halfW, halfD, top, tread]\` for \`bench\`. */
export const BLANK_BENCHES: ReadonlyArray<
  readonly [number, number, number, number, number, number]
> = [
${stamp.benches.map(formatBench).join("\n")}
];

/** \`[cx, cz, halfW, halfD, rimTop, steps]\` for \`terracePool\`. */
export const BLANK_POOLS: ReadonlyArray<
  readonly [number, number, number, number, number, number]
> = [
${stamp.pools.map(formatPool).join("\n")}
];

export const BLANK_HILLS: ReadonlyArray<readonly [number, number, number]> = [
${stamp.hills.map(formatHill).join("\n")}
];

export const BLANK_GAPS: ReadonlyArray<readonly [number, number]> = [
${stamp.gaps.map(formatCell).join("\n")}
];

export const BLANK_WATER: ReadonlyArray<readonly [number, number]> = [
${stamp.water.map(formatCell).join("\n")}
];

export const BLANK_SWAMP: ReadonlyArray<readonly [number, number]> = [
${stamp.swamp.map(formatCell).join("\n")}
];

export const BLANK_GRASS: ReadonlyArray<readonly [number, number]> = [
${stamp.grass.map(formatCell).join("\n")}
];

/** \`[x, z, h]\` structure piers. Occupancy; h is visual height from y=0. */
export const BLANK_PIERS: ReadonlyArray<readonly [number, number, number]> = [
${stamp.piers.map(formatHill).join("\n")}
];

export interface BlankPoi {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly ref: string;
}

/** Named places, each measured from a real landform. Location titles are the navigation system. */
export const BLANK_POIS: readonly BlankPoi[] = [
${pois}
];
`;
}
