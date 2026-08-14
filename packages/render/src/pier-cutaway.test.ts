import { describe, expect, it } from "vitest";
import {
  PIER_CUTAWAY_HIDE,
  PIER_CUTAWAY_NONE,
  PIER_CUTAWAY_SHOW,
  pierCutawayDist2,
  pierCutawayHidden,
} from "./pier-cutaway";

describe("pier cutaway", () => {
  it("hides a pier on the camera→cube segment and keeps the far wall", () => {
    // Default yaw-0 look: camera south of the cube.
    expect(pierCutawayDist2(0, 8, 0, 0, 0, 20)).toBeLessThanOrEqual(PIER_CUTAWAY_HIDE);
    expect(pierCutawayDist2(0, 1, 0, 0, 0, 20)).toBeLessThanOrEqual(PIER_CUTAWAY_HIDE);
    expect(pierCutawayDist2(0, -4, 0, 0, 0, 20)).toBe(PIER_CUTAWAY_NONE);
    expect(pierCutawayDist2(0, 24, 0, 0, 0, 20)).toBe(PIER_CUTAWAY_NONE);
  });

  it("does not hide a pier off the look corridor", () => {
    expect(pierCutawayDist2(8, 8, 0, 0, 0, 20)).toBeGreaterThan(PIER_CUTAWAY_SHOW);
  });

  it("holds the last state in the hysteresis band so a 21u wall cannot flicker", () => {
    expect(pierCutawayHidden(0, PIER_CUTAWAY_HIDE)).toBe(1);
    expect(pierCutawayHidden(1, PIER_CUTAWAY_HIDE + 0.5)).toBe(1);
    expect(pierCutawayHidden(0, PIER_CUTAWAY_HIDE + 0.5)).toBe(0);
    expect(pierCutawayHidden(1, PIER_CUTAWAY_SHOW + 0.01)).toBe(0);
    expect(pierCutawayHidden(1, PIER_CUTAWAY_NONE)).toBe(0);
  });
});
