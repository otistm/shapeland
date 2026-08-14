import { describe, expect, it } from "vitest";
import { WATER_RIDE_MAX, createWaterRide, stepWaterRide } from "./water-body";

const DT = 1 / 60;

describe("cube riding water on visual Y", () => {
  it("stays exactly on the lattice when the cube is dry", () => {
    const b = createWaterRide();
    for (let i = 0; i < 120; i++) expect(stepWaterRide(b, 0, DT)).toBe(0);
  });

  it("never goes below the lattice, because the cube already rests on the floor", () => {
    // The defect this guards: a sinking model clipped the cube into the terrain on entry, and
    // out of water gravity pinned it below the floor permanently.
    const b = createWaterRide();
    for (const wave of [0.2, -0.5, 0, 0.3, -0.9, 0]) {
      for (let i = 0; i < 40; i++) {
        expect(stepWaterRide(b, wave, DT)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("returns to the lattice after leaving the water, and stays there", () => {
    const b = createWaterRide();
    for (let i = 0; i < 60; i++) stepWaterRide(b, 0.15, DT);
    expect(b.y).toBeGreaterThan(0);
    for (let i = 0; i < 200; i++) stepWaterRide(b, 0, DT);
    expect(b.y).toBe(0);
    expect(stepWaterRide(b, 0, DT)).toBe(0);
  });

  it("is lifted by a wake, bounded by the cell it occupies", () => {
    const b = createWaterRide();
    let peak = 0;
    for (let i = 0; i < 400; i++) {
      const y = stepWaterRide(b, 0.16, DT);
      expect(y).toBeLessThanOrEqual(WATER_RIDE_MAX);
      if (y > peak) peak = y;
    }
    // The lift has to be visible, or the cube reads as pasted onto the surface.
    expect(peak).toBeGreaterThan(0.02);
    expect(WATER_RIDE_MAX).toBeLessThan(0.5);
  });

  it("clamps a long frame so a stall cannot launch the cube", () => {
    const b = createWaterRide();
    const y = stepWaterRide(b, 0.16, 5);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(WATER_RIDE_MAX);
  });
});
