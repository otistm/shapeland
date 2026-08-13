import { describe, expect, it } from "vitest";
import {
  ABILITY_FIRE,
  ABILITY_LIGHTNING,
  ABILITY_NORMAL,
  ABILITY_PHYSICAL,
  axisClash,
  facesLegal,
  grantAbility,
  parseLoadout,
  serializeLoadout,
} from "./loadout";
import { World } from "./world";

describe("found-gating", () => {
  it("rejects an undiscovered ability and keeps the cube blank", () => {
    const world = new World({ seed: 1, contentHash: 1 });
    expect(world.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0])).toBe(false);
    expect(world.faces[0]).toBe(ABILITY_NORMAL);
    world.grant(ABILITY_FIRE);
    expect(world.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0])).toBe(true);
    expect(world.faces[0]).toBe(ABILITY_FIRE);
  });

  it("restores finds from a tainted save but drops the illegal equip", () => {
    const parsed = parseLoadout({
      version: 1,
      found: [ABILITY_FIRE],
      faces: [ABILITY_LIGHTNING, 0, 0, 0, 0, 0],
    });
    expect(parsed.found).toBe(grantAbility(0, ABILITY_FIRE));
    expect(parsed.faces).toBeNull();
    expect(facesLegal([ABILITY_FIRE, 0, 0, 0, 0, 0], parsed.found)).toBe(true);
  });

  it("round-trips a legal loadout", () => {
    const found = grantAbility(grantAbility(0, ABILITY_FIRE), ABILITY_PHYSICAL);
    const faces = [ABILITY_FIRE, 0, 0, ABILITY_PHYSICAL, 0, 0];
    const parsed = parseLoadout(serializeLoadout(faces, found));
    expect(parsed.found).toBe(found);
    expect(parsed.faces).toEqual(faces);
  });
});

describe("axis clash", () => {
  it("flags opposite non-normal faces and ignores a blank opposite", () => {
    expect(axisClash([ABILITY_FIRE, ABILITY_LIGHTNING, 0, 0, 0, 0])).toBe(true);
    expect(axisClash([ABILITY_FIRE, 0, 0, 0, 0, 0])).toBe(false);
  });
});
