import { DIR_E, DIR_N, DIR_S, DIR_W, STRUCTURE_MARK, STRUCTURE_PEAK_MAX } from "./constants";
import { type Terrain, raiseRect } from "./terrain";

/**
 * Kit of parts for authored structures. Occupancy is a pier; the cube travels the void.
 * Visual height is independent of the walkable height map (ADR 0017).
 * Massing follows the brutalist protocol in docs/kb/architecture-and-construction.md §8.
 * Every kind stamps a multi-room interior the cube can explore from the door.
 */

export type StructureKind = "pylon_keep" | "salk_court" | "assembly" | "hypostyle" | "habitat";

export type StructureArchetype = "institutional" | "vertical" | "fortress";

export interface StructureSite {
  readonly kind: StructureKind;
  readonly cx: number;
  readonly cz: number;
}

/**
 * Floor for a building interior. A courtyard you glance into is not an interior; a cathedral
 * hall (21×34) minus partitions still clears this. A shack must still be a room you enter.
 * Asserted in `structure.test.ts`.
 */
export const INTERIOR_MIN = 160;

function clampH(h: number): number {
  const v = h | 0;
  if (v < 1) return 1;
  return v > STRUCTURE_PEAK_MAX ? STRUCTURE_PEAK_MAX : v;
}

function key(x: number, z: number): string {
  return `${x},${z}`;
}

function pier(terrain: Terrain, x: number, z: number, h: number): void {
  terrain.setPier(x, z, clampH(h));
}

/** Solid service core or load-bearing block. Axiom 1 and 2. */
export function fill(
  terrain: Terrain,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
): void {
  const vis = clampH(h);
  const xa = x0 < x1 ? x0 : x1;
  const xb = x0 < x1 ? x1 : x0;
  const za = z0 < z1 ? z0 : z1;
  const zb = z0 < z1 ? z1 : z0;
  for (let z = za; z <= zb; z++) {
    for (let x = xa; x <= xb; x++) pier(terrain, x, z, vis);
  }
}

function wallCol(
  terrain: Terrain,
  x: number,
  z0: number,
  z1: number,
  h: number,
  doors: readonly number[],
): void {
  const skip = new Set(doors);
  for (let z = z0; z <= z1; z++) {
    if (!skip.has(z)) pier(terrain, x, z, h);
  }
}

function wallRow(
  terrain: Terrain,
  z: number,
  x0: number,
  x1: number,
  h: number,
  doors: readonly number[],
): void {
  const skip = new Set(doors);
  for (let x = x0; x <= x1; x++) {
    if (!skip.has(x)) pier(terrain, x, z, h);
  }
}

function openDoor(
  openings: Set<string>,
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  dir: number,
  width: number,
): void {
  const w = width < 1 ? 1 : width | 0;
  const half = w >> 1;
  if (dir === DIR_E) {
    const x = cx + halfW;
    for (let i = -half; i <= half; i++) openings.add(key(x, cz + i));
  } else if (dir === DIR_W) {
    const x = cx - halfW;
    for (let i = -half; i <= half; i++) openings.add(key(x, cz + i));
  } else if (dir === DIR_N) {
    const z = cz - halfD;
    for (let i = -half; i <= half; i++) openings.add(key(cx + i, z));
  } else if (dir === DIR_S) {
    const z = cz + halfD;
    for (let i = -half; i <= half; i++) openings.add(key(cx + i, z));
  }
}

/** Cave gate: outer opening wider than the inner, so the entry compresses. */
function openCave(
  openings: Set<string>,
  cx: number,
  cz: number,
  outerHalfW: number,
  outerHalfD: number,
  innerHalfW: number,
  innerHalfD: number,
  dir: number,
  outerWidth: number,
  innerWidth: number,
): void {
  openDoor(openings, cx, cz, outerHalfW, outerHalfD, dir, outerWidth);
  openDoor(openings, cx, cz, innerHalfW, innerHalfD, dir, innerWidth);
}

/**
 * Perimeter occupancy. Interior cells stay walkable. Openings are door cells on the ring.
 * Wall thickness is 1. Plan is inclusive AABB.
 */
export function ring(
  terrain: Terrain,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
  openings: ReadonlySet<string>,
): void {
  const vis = clampH(h);
  for (let x = x0; x <= x1; x++) {
    if (!openings.has(key(x, z0))) pier(terrain, x, z0, vis);
    if (!openings.has(key(x, z1))) pier(terrain, x, z1, vis);
  }
  for (let z = z0 + 1; z < z1; z++) {
    if (!openings.has(key(x0, z))) pier(terrain, x0, z, vis);
    if (!openings.has(key(x1, z))) pier(terrain, x1, z, vis);
  }
}

/** Civic/fortress shell. A 1-cell ring is a fence; mass is at least 2 cells thick. */
export function thickRing(
  terrain: Terrain,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  thick: number,
  h: number,
  openings: ReadonlySet<string>,
): void {
  const t = thick < 1 ? 1 : thick | 0;
  for (let i = 0; i < t; i++) {
    if (x0 + i > x1 - i || z0 + i > z1 - i) break;
    ring(terrain, x0 + i, z0 + i, x1 - i, z1 - i, h, openings);
  }
}

function cornerPiers(
  terrain: Terrain,
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  h: number,
): void {
  fill(terrain, x0, z0, x0 + 1, z0 + 1, h);
  fill(terrain, x1 - 1, z0, x1, z0 + 1, h);
  fill(terrain, x0, z1 - 1, x0 + 1, z1, h);
  fill(terrain, x1 - 1, z1 - 1, x1, z1, h);
}

/**
 * Keep: 1-cell wall around an inner court, public door, optional 1-high plinth.
 * Used as a module inside Habitat, not as a finished civic interior.
 */
export function keep(
  terrain: Terrain,
  cx: number,
  cz: number,
  innerHalfW: number,
  innerHalfD: number,
  h: number,
  doorDir: number,
  doorWidth: number,
  plinth = 1,
): void {
  const iw = innerHalfW < 0 ? 0 : innerHalfW | 0;
  const id = innerHalfD < 0 ? 0 : innerHalfD | 0;
  const ow = iw + 1;
  const od = id + 1;
  const openings = new Set<string>();
  openDoor(openings, cx, cz, ow, od, doorDir, doorWidth);
  ring(terrain, cx - ow, cz - od, cx + ow, cz + od, h, openings);
  if (plinth > 0) raiseRect(terrain, cx - iw, cz - id, cx + iw, cz + id, plinth | 0);
}

/**
 * Castle keep (Boston City Hall massing). 21×33 shell — cathedral/castle hall from the
 * metrics table — cave gate, antechamber, nave, north and south chapels, far sanctuary,
 * 21u corner piers and an offset core. West keep opens east; east keep opens west.
 */
export function stampPylonKeep(terrain: Terrain, cx: number, cz: number): void {
  const door = cx < 0 ? DIR_E : DIR_W;
  const hw = 10;
  const hd = 16;
  const openings = new Set<string>();
  openCave(openings, cx, cz, hw, hd, hw - 1, hd - 1, door, 5, 3);
  thickRing(terrain, cx - hw, cz - hd, cx + hw, cz + hd, 2, STRUCTURE_MARK, openings);
  cornerPiers(terrain, cx - hw, cz - hd, cx + hw, cz + hd, STRUCTURE_PEAK_MAX);
  const x0 = cx - (hw - 2);
  const x1 = cx + (hw - 2);
  const z0 = cz - (hd - 2);
  const z1 = cz + (hd - 2);
  const h = STRUCTURE_MARK;
  if (door === DIR_E) {
    fill(terrain, cx - hw - 1, cz - 4, cx - hw, cz - 2, STRUCTURE_PEAK_MAX);
    wallCol(terrain, cx + 5, z0, z1, h, [cz - 1, cz, cz + 1]);
    wallCol(terrain, cx - 5, z0, z1, h, [cz]);
    wallRow(terrain, cz - 6, x0, cx + 4, h, [cx - 2]);
    wallRow(terrain, cz + 6, x0, cx + 4, h, [cx]);
    raiseRect(terrain, x0, cz - 1, cx - 6, cz + 1, 1);
    raiseRect(terrain, cx - 7, z0, cx - 5, z0, 1);
    raiseRect(terrain, cx - 7, z1, cx - 5, z1, 1);
  } else {
    fill(terrain, cx + hw, cz - 4, cx + hw + 1, cz - 2, STRUCTURE_PEAK_MAX);
    wallCol(terrain, cx - 5, z0, z1, h, [cz - 1, cz, cz + 1]);
    wallCol(terrain, cx + 5, z0, z1, h, [cz]);
    wallRow(terrain, cz - 6, cx - 4, x1, h, [cx + 2]);
    wallRow(terrain, cz + 6, cx - 4, x1, h, [cx + 6]);
    raiseRect(terrain, cx + 6, cz - 1, x1, cz + 1, 1);
    raiseRect(terrain, cx + 5, z0, cx + 7, z0, 1);
    raiseRect(terrain, cx + 5, z1, cx + 7, z1, 1);
  }
}

/**
 * Institutional campus (Salk Institute on the Cotton Castle plateau). Enclosed 33×29:
 * south cave, wing corridors with cells, north hall, central court as the canyon, opposing cores.
 */
export function stampSalkCourt(terrain: Terrain, cx: number, cz: number): void {
  const hw = 16;
  const hd = 14;
  const openings = new Set<string>();
  openCave(openings, cx, cz, hw, hd, hw - 1, hd - 1, DIR_S, 5, 3);
  thickRing(terrain, cx - hw, cz - hd, cx + hw, cz + hd, 2, STRUCTURE_MARK, openings);
  cornerPiers(terrain, cx - hw, cz - hd, cx + hw, cz + hd, STRUCTURE_PEAK_MAX);
  fill(terrain, cx - hw - 1, cz - hd, cx - hw, cz - hd + 1, STRUCTURE_PEAK_MAX);
  fill(terrain, cx + hw, cz + hd - 1, cx + hw + 1, cz + hd, STRUCTURE_PEAK_MAX);
  const x0 = cx - (hw - 2);
  const x1 = cx + (hw - 2);
  const z0 = cz - (hd - 2);
  const z1 = cz + (hd - 2);
  const h = STRUCTURE_MARK;
  wallCol(terrain, cx - 9, z0, z1, h, [cz - 6, cz + 5]);
  wallCol(terrain, cx + 9, z0, z1, h, [cz - 5, cz + 6]);
  wallRow(terrain, cz - 6, x0, cx - 10, h, [cx - 12]);
  wallRow(terrain, cz + 4, x0, cx - 10, h, [cx - 11]);
  wallRow(terrain, cz - 4, cx + 10, x1, h, [cx + 12]);
  wallRow(terrain, cz + 6, cx + 10, x1, h, [cx + 11]);
  wallRow(terrain, cz - 7, cx - 8, cx + 8, h, [cx + 2]);
  raiseRect(terrain, cx - 4, cz - 1, cx + 4, cz + 1, 1);
  raiseRect(terrain, x0, cz - 10, x0, cz - 8, 1);
  raiseRect(terrain, x1, cz + 8, x1, cz + 10, 1);
}

/**
 * Cathedral (Kahn / Jatiya Sangsad on the Ur plinth). 33×33 shell, cave south gate,
 * processional nave to the socket, side aisles, sanctuary, SW chamber.
 * Socket at (cx, cz+1) stays clear.
 */
export function stampAssembly(terrain: Terrain, cx: number, cz: number): void {
  const halfW = 16;
  const halfD = 16;
  const openings = new Set<string>();
  openCave(openings, cx, cz, halfW, halfD, halfW - 1, halfD - 1, DIR_S, 5, 3);
  openDoor(openings, cx, cz, halfW, halfD, DIR_W, 3);
  openDoor(openings, cx, cz, halfW - 1, halfD - 1, DIR_W, 3);
  openDoor(openings, cx, cz, halfW, halfD, DIR_E, 1);
  openDoor(openings, cx, cz, halfW - 1, halfD - 1, DIR_E, 1);
  thickRing(
    terrain,
    cx - halfW,
    cz - halfD,
    cx + halfW,
    cz + halfD,
    2,
    STRUCTURE_PEAK_MAX,
    openings,
  );
  fill(terrain, cx + 12, cz - 14, cx + 14, cz - 12, STRUCTURE_PEAK_MAX);
  const x0 = cx - 14;
  const x1 = cx + 14;
  const z0 = cz - 14;
  const z1 = cz + 14;
  const h = STRUCTURE_MARK;
  wallRow(terrain, cz + 8, x0, x1, h, [cx - 1, cx, cx + 1]);
  wallCol(terrain, cx - 8, z0, cz + 7, h, [cz + 3, cz - 5]);
  wallCol(terrain, cx + 8, z0, cz + 7, h, [cz + 4, cz - 4]);
  wallRow(terrain, cz - 8, x0, x1, h, [cx]);
  wallCol(terrain, cx - 11, cz + 8, cz + 12, h, [cz + 10]);
  wallRow(terrain, cz + 10, cx - 14, cx - 11, h, [cx - 13]);
  wallRow(terrain, cz + 12, cx - 14, cx - 11, h, []);
  raiseRect(terrain, cx - 13, cz - 12, cx - 10, cz - 12, 1);
  raiseRect(terrain, cx + 10, cz - 12, cx + 12, cz - 12, 1);
  raiseRect(terrain, cx - 4, cz + 13, cx + 4, cz + 13, 1);
}

/**
 * Cathedral nave (Karnak hypostyle on the Giant's Causeway). 33×33 waffle hall, 3-wide
 * processional nave, south cave, west chapels, north sanctuary, east core.
 */
export function stampHypostyle(terrain: Terrain, cx: number, cz: number): void {
  const hw = 16;
  const hd = 16;
  const openings = new Set<string>();
  openCave(openings, cx, cz, hw, hd, hw - 1, hd - 1, DIR_S, 5, 3);
  thickRing(terrain, cx - hw, cz - hd, cx + hw, cz + hd, 2, STRUCTURE_MARK, openings);
  cornerPiers(terrain, cx - hw, cz - hd, cx + hw, cz + hd, STRUCTURE_PEAK_MAX);
  fill(terrain, cx + hw + 1, cz - 1, cx + hw + 2, cz, STRUCTURE_PEAK_MAX);
  const h = STRUCTURE_MARK;
  for (let z = cz - 12; z <= cz + 10; z += 3) {
    for (let x = cx - 9; x <= cx + 9; x += 3) {
      if (x >= cx - 1 && x <= cx + 1) continue;
      pier(terrain, x, z, h);
    }
  }
  const x0 = cx - (hw - 2);
  const z0 = cz - (hd - 2);
  const z1 = cz + (hd - 2);
  wallCol(terrain, cx - 11, z0, z1, h, [cz - 8, cz, cz + 7]);
  wallRow(terrain, cz - 5, x0, cx - 12, h, [cx - 13]);
  wallRow(terrain, cz + 5, x0, cx - 12, h, [cx - 12]);
  wallRow(terrain, cz - 12, cx - 8, cx + 8, h, [cx]);
  raiseRect(terrain, cx - 1, cz + 12, cx + 1, cz + 12, 1);
  raiseRect(terrain, x0, cz - 10, x0, cz - 7, 1);
  raiseRect(terrain, cx - 1, cz - 13, cx + 1, cz - 13, 1);
}

/**
 * Stacked dwellings (Habitat 67 / a shack you enter). 21×17: four modules, crossing corridor,
 * east core, south terraces you climb. Smallest civic kind — still a place, not a closet.
 */
export function stampHabitat(terrain: Terrain, cx: number, cz: number): void {
  const hw = 10;
  const hd = 8;
  const openings = new Set<string>();
  openCave(openings, cx, cz, hw, hd, hw - 1, hd - 1, DIR_S, 3, 1);
  thickRing(terrain, cx - hw, cz - hd, cx + hw, cz + hd, 2, STRUCTURE_MARK, openings);
  cornerPiers(terrain, cx - hw, cz - hd, cx + hw, cz + hd, STRUCTURE_PEAK_MAX);
  fill(terrain, cx + hw + 1, cz - 2, cx + hw + 2, cz - 1, STRUCTURE_PEAK_MAX);
  const x0 = cx - (hw - 2);
  const x1 = cx + (hw - 2);
  const z0 = cz - (hd - 2);
  const z1 = cz + (hd - 2);
  const h = STRUCTURE_MARK;
  wallCol(terrain, cx, z0, z1, h, [cz - 3, cz - 1, cz, cz + 1, cz + 3, z1]);
  wallRow(terrain, cz, x0, x1, h, [cx - 3, cx - 1, cx, cx + 1, cx + 3]);
  raiseRect(terrain, cx - 6, cz - 5, cx - 4, cz - 5, 1);
  raiseRect(terrain, cx + 4, cz - 5, cx + 6, cz - 5, 1);
  raiseRect(terrain, cx - 6, cz + 5, cx - 4, cz + 5, 1);
  raiseRect(terrain, cx + 4, cz + 5, cx + 6, cz + 5, 1);
  raiseRect(terrain, cx - 4, cz + hd + 1, cx - 2, cz + hd + 2, 3);
  raiseRect(terrain, cx + 2, cz + hd + 1, cx + 4, cz + hd + 2, 5);
}

export function stampStructure(terrain: Terrain, site: StructureSite): void {
  if (site.kind === "pylon_keep") stampPylonKeep(terrain, site.cx, site.cz);
  else if (site.kind === "salk_court") stampSalkCourt(terrain, site.cx, site.cz);
  else if (site.kind === "assembly") stampAssembly(terrain, site.cx, site.cz);
  else if (site.kind === "hypostyle") stampHypostyle(terrain, site.cx, site.cz);
  else stampHabitat(terrain, site.cx, site.cz);
}

export function structureArchetype(kind: StructureKind): StructureArchetype {
  if (kind === "salk_court" || kind === "hypostyle") return "institutional";
  if (kind === "habitat") return "vertical";
  return "fortress";
}

/** Inclusive AABB used by validatePlan. Covers cores, wings, and Habitat terraces. */
export function structureExtent(site: StructureSite): {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
} {
  if (site.kind === "pylon_keep") {
    return { x0: site.cx - 11, z0: site.cz - 16, x1: site.cx + 11, z1: site.cz + 16 };
  }
  if (site.kind === "salk_court") {
    return { x0: site.cx - 17, z0: site.cz - 14, x1: site.cx + 17, z1: site.cz + 14 };
  }
  if (site.kind === "assembly") {
    return { x0: site.cx - 16, z0: site.cz - 16, x1: site.cx + 16, z1: site.cz + 16 };
  }
  if (site.kind === "hypostyle") {
    return { x0: site.cx - 16, z0: site.cz - 16, x1: site.cx + 18, z1: site.cz + 16 };
  }
  return { x0: site.cx - 10, z0: site.cz - 8, x1: site.cx + 12, z1: site.cz + 10 };
}
