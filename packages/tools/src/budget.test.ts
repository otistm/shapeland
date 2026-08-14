import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS } from "./budget";

describe("frame budget ledger", () => {
  it("declares sim, render, and vfx lines", () => {
    expect(FRAME_BUDGET_MS.simTick).toBe(8);
    expect(FRAME_BUDGET_MS.render).toBe(8);
    expect(FRAME_BUDGET_MS.vfx).toBe(4);
    expect(FRAME_BUDGET_MS.world).toBe(1);
    expect(FRAME_BUDGET_MS.terrain).toBe(1);
    expect(FRAME_BUDGET_MS.input).toBe(1);
    expect(FRAME_BUDGET_MS.camera).toBe(1);
    expect(FRAME_BUDGET_MS.ice).toBe(1);
    expect(FRAME_BUDGET_MS.water).toBe(1);
  });
});
