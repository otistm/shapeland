import { describe, expect, it } from "vitest";
import {
  bodyRadius,
  fireErosion,
  fireRamp,
  lickStretch,
  luminance,
  particleFade,
  premultiply,
  tearGain,
} from "./fire-ramp";

describe("qa-fire ramp", () => {
  it("is monotone in luminance, red, and blue for T > 0.18", () => {
    let prev = fireRamp(0.18);
    let prevY = luminance(prev);
    for (let i = 1; i <= 82; i++) {
      const T = 0.18 + (i / 82) * (1 - 0.18);
      const c = fireRamp(T);
      expect(c.r).toBeGreaterThanOrEqual(prev.r - 1e-9);
      expect(c.b).toBeGreaterThanOrEqual(prev.b - 1e-9);
      expect(luminance(c)).toBeGreaterThanOrEqual(prevY - 1e-9);
      prev = c;
      prevY = luminance(c);
    }
  });

  it("keeps the smoke tail brighter than dark ember", () => {
    expect(luminance(fireRamp(0))).toBeGreaterThan(luminance(fireRamp(0.18)));
  });

  it("shrinks the body and raises the tear as T falls", () => {
    expect(bodyRadius(1)).toBeGreaterThan(bodyRadius(0.5));
    expect(bodyRadius(0.5)).toBeGreaterThan(bodyRadius(0));
    expect(tearGain(0)).toBeGreaterThan(tearGain(1));
    const hot = fireErosion(0.7, 1, 0.52);
    const cold = fireErosion(0.7, 0.2, 0.52);
    expect(hot).toBeLessThan(cold);
  });

  it("stretch is 1 at rest, monotone, and saturates", () => {
    expect(lickStretch(0)).toBe(1);
    expect(lickStretch(1)).toBeGreaterThan(lickStretch(0.5));
    expect(lickStretch(100)).toBe(1 + 1.15);
    expect(lickStretch(100)).toBe(lickStretch(200));
  });

  it("premultiplied fade drives RGB and A to 0 together", () => {
    const dead = premultiply(fireRamp(0.5), particleFade(0, 2, 1, 1.35));
    expect(dead.r).toBe(0);
    expect(dead.g).toBe(0);
    expect(dead.b).toBe(0);
    expect(dead.a).toBe(0);
  });
});
