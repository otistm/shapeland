import { describe, expect, it } from "vitest";
import { COMPASS_MARKS, COMPASS_QUARTER_PX, compassTapeX, wrapHeading } from "./compass";

describe("compass tape", () => {
  it("orders N E S W so yaw 0 is north", () => {
    expect(COMPASS_MARKS).toEqual(["N", "E", "S", "W"]);
    expect(wrapHeading(0)).toBe(0);
    expect(wrapHeading(4)).toBe(0);
    expect(wrapHeading(-1)).toBe(3);
  });

  it("shifts one quarter-width per quarter-turn and wraps by a full cycle", () => {
    const q = COMPASS_QUARTER_PX;
    const n = compassTapeX(0, q);
    const e = compassTapeX(1, q);
    expect(e - n).toBe(-q);
    expect(n).toBe(-(4 * q + q / 2));
    expect(compassTapeX(4, q)).toBe(n);
    expect(compassTapeX(0.01, q) - compassTapeX(3.99, q)).toBeCloseTo(3.98 * q, 5);
  });
});
