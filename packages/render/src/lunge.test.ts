import { SQUASH_DAMP, SQUASH_STIFF, TURRET_STATE_AIM, TURRET_STATE_COOL } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { createLunge, spikeRise, stepLunge } from "./lunge";

describe("lunge spring", () => {
  it("uses the cube squash spring constants", () => {
    expect(SQUASH_STIFF).toBe(300);
    expect(SQUASH_DAMP).toBe(21);
  });

  it("keeps hunting the cube while it stays in radius, even at idle", () => {
    const s = createLunge();
    stepLunge(s, 0, 1, 0, 4, 1, 0, TURRET_STATE_COOL, 0, 72, true, 1 / 120, false, 42, true);
    expect(s.vx).toBeGreaterThan(0);
    for (let i = 0; i < 24; i++) {
      stepLunge(s, 0, 1, 0, 4, 1, 0, 0, 0, 72, false, 1 / 120, false, 42, true);
    }
    expect(s.x).toBeGreaterThan(2.4);
  });

  it("releases only after the cube leaves the radius", () => {
    const s = createLunge();
    for (let i = 0; i < 24; i++) {
      stepLunge(s, 0, 1, 0, 4, 1, 0, 0, 0, 72, false, 1 / 120, false, 42, true);
    }
    expect(s.x).toBeGreaterThan(2.4);
    for (let i = 0; i < 240; i++) {
      stepLunge(s, 0, 1, 0, 20, 1, 0, 0, 0, 72, false, 1 / 120, false, 25, true);
    }
    expect(Math.abs(s.x)).toBeLessThan(0.05);
    expect(Math.abs(s.vx)).toBeLessThan(0.05);
  });

  it("does not chase when the cube is out of reach", () => {
    const s = createLunge();
    for (let i = 0; i < 30; i++) {
      stepLunge(s, 0, 1, 0, 12, 1, 0, TURRET_STATE_COOL, 4, 72, false, 1 / 120, false, 25, true);
    }
    expect(Math.abs(s.x)).toBeLessThan(0.05);
  });

  it("does not coil away — persist hunts during aim too", () => {
    const s = createLunge();
    for (let i = 0; i < 20; i++) {
      stepLunge(s, 0, 1, 0, 4, 1, 0, TURRET_STATE_AIM, 20, 72, false, 1 / 120, false, 42, true);
    }
    expect(s.x).toBeGreaterThan(0);
  });

  it("pops spikes to full height under reduced motion", () => {
    expect(spikeRise(4, 22, true)).toBe(1);
    expect(spikeRise(4, 22, false)).toBeLessThan(1);
    expect(spikeRise(0, 22, false)).toBe(0);
    expect(spikeRise(23, 22, false)).toBe(0);
  });
});
