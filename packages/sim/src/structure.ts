import { DIR_E, DIR_N, DIR_S, DIR_W, STRUCTURE_MARK, STRUCTURE_PEAK_MAX } from "./constants";
import { type Terrain, raiseRect } from "./terrain";

/**
 * Kit of parts for authored structures. Occupancy is a pier; the cube travels the void.
 * Visual height is independent of the walkable height map (ADR 0017).
 */

export type StructureKind = "pylon_keep" | "salk_court" | "assembly" | "hypostyle" | "habitat";

export interface StructureSite {
  readonly kind: StructureKind;
  readonly cx: number;
  readonly cz: number;
}

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

/**
 * Keep: 1-cell wall around an inner court, public door, optional 1-high plinth in the court.
 * Inner plan is (2*innerHalfW+1) × (2*innerHalfD+1). Outer is two cells larger.
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
 * Paired Watchers. Boston City Hall massing: 21u keep, 3×3 court, public 3-cell door facing the
 * axis. West keep opens east; east keep opens west. Compression then the 72-cell prospect.
 */
export function stampPylonKeep(terrain: Terrain, cx: number, cz: number): void {
  const door = cx < 0 ? DIR_E : DIR_W;
  keep(terrain, cx, cz, 1, 1, STRUCTURE_PEAK_MAX, door, 3, 1);
}

/**
 * Salk Institute: two lab bars flanking a court that opens to the horizon. Bars are 21u; the
 * court is the plateau. No south wall — drainage and arrival stay the open end.
 */
export function stampSalkCourt(terrain: Terrain, cx: number, cz: number): void {
  const h = STRUCTURE_PEAK_MAX;
  const z0 = cz - 5;
  const z1 = cz + 5;
  for (let z = z0; z <= z1; z++) {
    pier(terrain, cx - 8, z, h);
    pier(terrain, cx - 7, z, h);
    pier(terrain, cx + 7, z, h);
    pier(terrain, cx + 8, z, h);
  }
}

/**
 * Kahn's National Assembly as a 2.5D ring on the ziggurat plinth. Monumental south gate (5),
 * secondary east/west doors (3), north closed — three sides of refuge, one prospect.
 */
export function stampAssembly(terrain: Terrain, cx: number, cz: number): void {
  const halfW = 14;
  const halfD = 9;
  const openings = new Set<string>();
  openDoor(openings, cx, cz, halfW, halfD, DIR_S, 5);
  openDoor(openings, cx, cz, halfW, halfD, DIR_E, 3);
  openDoor(openings, cx, cz, halfW, halfD, DIR_W, 3);
  ring(terrain, cx - halfW, cz - halfD, cx + halfW, cz + halfD, STRUCTURE_PEAK_MAX, openings);
}

/**
 * Hypostyle hall 13×21, piers 1×1 at spacing 3 (diastyle for d=1), nave on the centre axis clear.
 * Height 13 so the 1–4 causeway columns in front prove the hall.
 */
export function stampHypostyle(terrain: Terrain, cx: number, cz: number): void {
  const halfW = 6;
  const halfD = 10;
  const h = STRUCTURE_MARK;
  for (let z = cz - halfD; z <= cz + halfD; z += 2) {
    for (let x = cx - halfW; x <= cx + halfW; x += 2) {
      if (x === cx) continue;
      pier(terrain, x, z, h);
    }
  }
}

/**
 * Habitat 67: offset 3×3 modules. Terraces you climb (height only) and keeps you enter.
 * The 21u stack is the countable tower in the cluster.
 */
export function stampHabitat(terrain: Terrain, cx: number, cz: number): void {
  raiseRect(terrain, cx - 4, cz - 4, cx - 2, cz - 2, 3);
  raiseRect(terrain, cx + 2, cz - 4, cx + 4, cz - 2, 5);
  keep(terrain, cx - 4, cz + 3, 1, 1, STRUCTURE_MARK, DIR_E, 1, 1);
  keep(terrain, cx + 4, cz + 3, 1, 1, 8, DIR_S, 1, 1);
  pier(terrain, cx + 7, cz, STRUCTURE_PEAK_MAX);
  pier(terrain, cx + 8, cz, STRUCTURE_PEAK_MAX);
  pier(terrain, cx + 7, cz + 1, STRUCTURE_PEAK_MAX);
  pier(terrain, cx + 8, cz + 1, STRUCTURE_PEAK_MAX);
}

export function stampStructure(terrain: Terrain, site: StructureSite): void {
  if (site.kind === "pylon_keep") stampPylonKeep(terrain, site.cx, site.cz);
  else if (site.kind === "salk_court") stampSalkCourt(terrain, site.cx, site.cz);
  else if (site.kind === "assembly") stampAssembly(terrain, site.cx, site.cz);
  else if (site.kind === "hypostyle") stampHypostyle(terrain, site.cx, site.cz);
  else stampHabitat(terrain, site.cx, site.cz);
}

/** Inclusive AABB used by validatePlan. Generous enough to cover Habitat's +5 module. */
export function structureExtent(site: StructureSite): {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
} {
  if (site.kind === "pylon_keep") {
    return { x0: site.cx - 2, z0: site.cz - 2, x1: site.cx + 2, z1: site.cz + 2 };
  }
  if (site.kind === "salk_court") {
    return { x0: site.cx - 8, z0: site.cz - 5, x1: site.cx + 8, z1: site.cz + 5 };
  }
  if (site.kind === "assembly") {
    return { x0: site.cx - 14, z0: site.cz - 9, x1: site.cx + 14, z1: site.cz + 9 };
  }
  if (site.kind === "hypostyle") {
    return { x0: site.cx - 6, z0: site.cz - 10, x1: site.cx + 6, z1: site.cz + 10 };
  }
  return { x0: site.cx - 6, z0: site.cz - 4, x1: site.cx + 8, z1: site.cz + 5 };
}
