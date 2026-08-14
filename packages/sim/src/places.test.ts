import { START } from "./slice";
import { describe, expect, it } from "vitest";
import { PLACE_RADIUS, nearestPlace } from "./places";

describe("named places", () => {
  it("does not steal THE BLANK at spawn — Watchers is inside the radius, titles wait for a change", () => {
    const here = nearestPlace(START.x, START.z);
    expect(here?.name).toBe("THE WATCHERS");
    expect(PLACE_RADIUS).toBe(16);
  });

  it("claims a district at the apron, not only the summit", () => {
    expect(nearestPlace(24, -132)?.name).toBe("THE COMB");
    expect(nearestPlace(24 + PLACE_RADIUS, -132)?.name).toBe("THE COMB");
    expect(nearestPlace(24 + PLACE_RADIUS + 1, -132)).toBeNull();
  });
});
