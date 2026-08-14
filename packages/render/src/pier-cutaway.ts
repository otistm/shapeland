/**
 * Camera-side cutaway for structure piers. Occupancy stays; only the instance scale changes.
 * Terrain columns still lift the camera (occlusionLift). A 21u wall cannot — lifting over it
 * pitches the quarter-turn rig at the sky, so the near facade hides instead.
 */

/** Distance² to the look segment at or under which a pier hides. 1.5 cells. */
export const PIER_CUTAWAY_HIDE = 2.25;
/** Distance² beyond which a hidden pier shows again. 2 cells — hysteresis against flicker. */
export const PIER_CUTAWAY_SHOW = 4;
/** Not on the near-side segment. Larger than SHOW so hysteresis reveals. */
export const PIER_CUTAWAY_NONE = 1e9;

/**
 * Squared distance from a pier cell to the camera→cube segment.
 * Returns `PIER_CUTAWAY_NONE` when the cell is behind the cube or behind the camera,
 * so the far wall of a room stays and the near wall does not.
 */
export function pierCutawayDist2(
  cellX: number,
  cellZ: number,
  cubeX: number,
  cubeZ: number,
  camX: number,
  camZ: number,
): number {
  const vx = cubeX - camX;
  const vz = cubeZ - camZ;
  const len2 = vx * vx + vz * vz;
  if (len2 < 1e-8) return PIER_CUTAWAY_NONE;
  const t = ((cellX - camX) * vx + (cellZ - camZ) * vz) / len2;
  if (t <= 0 || t >= 1) return PIER_CUTAWAY_NONE;
  const dx = cellX - (camX + t * vx);
  const dz = cellZ - (camZ + t * vz);
  return dx * dx + dz * dz;
}

/** Hysteresis: hide inside 1.5 cells, show outside 2, keep the last state in the band. */
export function pierCutawayHidden(prev: number, dist2: number): number {
  if (dist2 <= PIER_CUTAWAY_HIDE) return 1;
  if (dist2 > PIER_CUTAWAY_SHOW) return 0;
  return prev === 1 ? 1 : 0;
}
