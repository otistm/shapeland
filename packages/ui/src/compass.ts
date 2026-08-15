/** Cardinals in camera yaw order. Yaw 0 looks −Z (north on The Blank). */
export const COMPASS_MARKS = ["N", "E", "S", "W"] as const;
/** Width of one quarter-turn on the tape. */
export const COMPASS_QUARTER_PX = 80;
/** Repeated cycles so a wrap at 0/4 stays a full period and does not flash empty. */
export const COMPASS_CYCLES = 3;

/** Wrap heading into [0, 4) quarter-turns. */
export function wrapHeading(heading: number): number {
  let h = heading % 4;
  if (h < 0) h += 4;
  return h;
}

/**
 * Tape translateX so the look mark sits on `heading`.
 * Three cycles; the middle copy is the one on screen.
 */
export function compassTapeX(heading: number, quarterPx = COMPASS_QUARTER_PX): number {
  const h = wrapHeading(heading);
  return -(h * quarterPx + 4 * quarterPx + quarterPx / 2);
}
