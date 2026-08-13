import { describe, expect, it } from "vitest";
import { BOLT_POINTS, BOLT_TOP, SPREAD_DUR, SPREAD_R } from "./constants";
import { generateBolt, spreadFront, zapSpeed } from "./lightning";

describe("qa-vfx lightning", () => {
  it("builds a 33-point channel that descends and pins the strike", () => {
    const bolt = generateBolt(42, 3, -4, 1);
    expect(bolt.mainCount).toBe(BOLT_POINTS);
    expect(bolt.branchCount).toBeGreaterThanOrEqual(3);
    expect(bolt.branchCount).toBeLessThanOrEqual(5);
    let prevY = Number.POSITIVE_INFINITY;
    for (let i = 0; i < bolt.mainCount; i++) {
      const y = bolt.main[i * 3 + 1] ?? 0;
      expect(y).toBeLessThanOrEqual(prevY + 1e-9);
      prevY = y;
    }
    expect(bolt.main[1]).toBe(BOLT_TOP);
    const last = (bolt.mainCount - 1) * 3;
    expect(bolt.main[last]).toBe(3);
    expect(bolt.main[last + 1]).toBe(1);
    expect(bolt.main[last + 2]).toBe(-4);
  });

  it("is seeded: the same seed reprints the channel", () => {
    const a = generateBolt(9, 0, 0, 0);
    const b = generateBolt(9, 0, 0, 0);
    expect([...a.main]).toEqual([...b.main]);
    expect(a.branchCount).toBe(b.branchCount);
  });

  it("spread front decelerates to 2.6 over 0.45s", () => {
    expect(spreadFront(0)).toBe(0);
    expect(spreadFront(SPREAD_DUR)).toBe(SPREAD_R);
    const d0 = spreadFront(0.05) - spreadFront(0);
    const d1 = spreadFront(SPREAD_DUR) - spreadFront(SPREAD_DUR - 0.05);
    expect(d0).toBeGreaterThan(d1);
  });

  it("zap speed decays from a non-compounding reference", () => {
    const v0 = 4.8;
    const drag = 0.9;
    const a = zapSpeed(v0, drag, 0.1);
    const compounded = v0 * (1 - drag * 0.1) * (1 - drag * 0.1);
    expect(a).toBeCloseTo(v0 * (1 - drag * 0.1), 10);
    expect(a).toBeGreaterThan(compounded);
  });
});
