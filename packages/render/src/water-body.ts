/**
 * How the cube rides water, on **visual Y only**.
 *
 * Wallace's sphere physics (`percentUnderWater`, reduced gravity, quadratic drag) was tried and
 * rejected here, and the reason is geometric rather than aesthetic: his sphere falls through a
 * 1-unit-deep pool toward a bottom well below it, whereas Shapeland's cube already rests with its
 * bottom **exactly on the cell floor**. There is no room to sink, so every downward offset clipped
 * the cube into the terrain, and out of water gravity pinned it below the floor permanently.
 *
 * The cube is also denser than water by design — that is why jump refuses from a wet cell — so
 * sitting on the bottom is the honest read. What remains is the part that is actually visible: a
 * passing wake **lifts** it. The offset is therefore never negative, and always returns to zero.
 *
 * The lattice never sees this: cell, orientation, and camera resting height stay integer.
 */

/** Fraction of the local water height the cube follows. */
export const WATER_RIDE = 0.6;
/** Ceiling on the lift, so the cube can never appear to leave the cell it occupies. */
export const WATER_RIDE_MAX = 0.12;
export const WATER_RIDE_STIFF = 120;
export const WATER_RIDE_DAMP = 15;

export interface WaterRide {
  /** Visual Y offset. Always `0..WATER_RIDE_MAX` — never negative, or the cube clips the floor. */
  y: number;
  vy: number;
}

export function createWaterRide(): WaterRide {
  return { y: 0, vy: 0 };
}

/**
 * @param waveHeight Local field height at the cube, or 0 when it is not in water.
 * @returns the visual Y offset to add to the cube's lattice position, never negative.
 */
export function stepWaterRide(b: WaterRide, waveHeight: number, dt: number): number {
  const lift = waveHeight * WATER_RIDE;
  const target = lift < 0 ? 0 : lift > WATER_RIDE_MAX ? WATER_RIDE_MAX : lift;
  // Clamp the step so a stalled frame cannot integrate the spring into a launch.
  const step = dt > 1 / 30 ? 1 / 30 : dt;
  const acc = -WATER_RIDE_STIFF * (b.y - target) - WATER_RIDE_DAMP * b.vy;
  b.vy += acc * step;
  b.y += b.vy * step;
  if (b.y <= 0) {
    b.y = 0;
    if (b.vy < 0) b.vy = 0;
  } else if (b.y > WATER_RIDE_MAX) {
    b.y = WATER_RIDE_MAX;
    if (b.vy > 0) b.vy = 0;
  }
  return b.y;
}
