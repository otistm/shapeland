import { describe, expect, it } from "vitest";
import { DT, FIRE_MAX, FIRE_PUFF_HZ } from "./constants";
import { FireField } from "./fire";
import { seedSfc32 } from "./rng";

describe("qa-fire plume", () => {
  it("never exceeds the 340 cap while burning", () => {
    const fire = new FireField();
    const rng = seedSfc32(7, "physics");
    for (let t = 0; t < 10_000; t++) {
      fire.step(1, 0, 0, 0, rng);
      expect(fire.count).toBeLessThanOrEqual(FIRE_MAX);
    }
    expect(fire.count).toBeGreaterThan(0);
  });

  it("puffs on the 1.5 Hz clock at D = 1", () => {
    expect(FIRE_PUFF_HZ).toBe(1.5);
    const period = 1 / FIRE_PUFF_HZ;
    expect(period / DT).toBeCloseTo(80, 10);
  });

  it("cools and rises: mean T falls, mean height rises from the source", () => {
    const fire = new FireField();
    const rng = seedSfc32(3, "physics");
    for (let t = 0; t < 48; t++) fire.step(1, 0, 0, 0, rng);
    expect(fire.count).toBeGreaterThan(0);
    const t0 = fire.meanT();
    const y0 = fire.meanHeight();
    for (let t = 0; t < 40; t++) fire.step(0, 0, 0, 0, rng);
    expect(fire.meanT()).toBeLessThan(t0);
    expect(fire.meanHeight()).toBeGreaterThan(y0);
  });

  it("does not allocate per spawn past the pool (swap-remove stays in cap)", () => {
    const fire = new FireField();
    const rng = seedSfc32(1, "physics");
    fire.step(1, 0, 0, 0, rng);
    const before = fire.x;
    for (let t = 0; t < 240; t++) fire.step(1, 0, 0, 0, rng);
    expect(fire.x).toBe(before);
    expect(fire.x.length).toBe(FIRE_MAX);
  });
});
