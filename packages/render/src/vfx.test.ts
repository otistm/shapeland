import { describe, expect, it } from "vitest";
import { boltReadable } from "./vfx";

describe("qa-vfx readability", () => {
  it("keeps the lightning channel readable under reduced motion", () => {
    expect(boltReadable(true, 1)).toBe(true);
    expect(boltReadable(true, 0.3)).toBe(true);
    expect(boltReadable(false, 0)).toBe(false);
  });
});
