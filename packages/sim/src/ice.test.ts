import { describe, expect, it } from "vitest";
import { BANNER_ICE, FLAG_LAND, STAGE_INSIDE } from "./constants";
import { assertIce, proveIce } from "./ice-proof";
import { ABILITY_ICE } from "./loadout";
import { DOWN } from "./orientation";
import { ICE_GLYPH, stepSlice } from "./slice";
import { World } from "./world";

describe("ice proofs", () => {
  it("proves freeze AOE, slide grammar, melt, and unchanged socket pins", () => {
    const failed = proveIce()
      .filter((line) => !line.ok)
      .map((line) => line.message);
    expect(failed).toEqual([]);
    expect(() => assertIce()).not.toThrow();
  });
});

describe("ice glyph", () => {
  it("stamps Ice onto the down face without advancing STAGE_DONE", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    world.doorOpen = 1;
    world.stage = STAGE_INSIDE;
    world.x = ICE_GLYPH.x;
    world.z = ICE_GLYPH.z;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.iceTaken).toBe(1);
    expect(world.found & (1 << ABILITY_ICE)).not.toBe(0);
    expect(world.faces[DOWN(world.orientation)]).toBe(ABILITY_ICE);
    expect(world.stage).toBe(STAGE_INSIDE);
    expect(world.banner).toBe(BANNER_ICE);
  });
});
