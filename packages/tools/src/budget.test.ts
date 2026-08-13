import { describe, expect, it } from "vitest";
import { FRAME_BUDGET_MS } from "./budget";

describe("frame budget ledger", () => {
  it("declares sim and render lines at 8ms", () => {
    expect(FRAME_BUDGET_MS.simTick).toBe(8);
    expect(FRAME_BUDGET_MS.render).toBe(8);
  });
});
