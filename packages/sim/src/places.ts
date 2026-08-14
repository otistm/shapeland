import { BLANK_POIS, type BlankPoi } from "./blank-stamp";

/**
 * Chebyshev radius at which a named place claims the location title.
 * 16 cells is the apron edge of a height-8 1:1 bench — the threshold, not the summit.
 */
export const PLACE_RADIUS = 16;

function cheb(ax: number, az: number, bx: number, bz: number): number {
  const dx = ax < bx ? bx - ax : ax - bx;
  const dz = az < bz ? bz - az : az - bz;
  return dx > dz ? dx : dz;
}

/** Nearest authored Blank POI within `maxCheb`, or null. Ties break by plan order. */
export function nearestPlace(x: number, z: number, maxCheb: number = PLACE_RADIUS): BlankPoi | null {
  let best: BlankPoi | null = null;
  let bestD = maxCheb + 1;
  for (let i = 0; i < BLANK_POIS.length; i++) {
    const poi = BLANK_POIS[i];
    if (!poi) continue;
    const d = cheb(x, z, poi.x, poi.z);
    if (d < bestD) {
      bestD = d;
      best = poi;
    }
  }
  return bestD <= maxCheb ? best : null;
}
