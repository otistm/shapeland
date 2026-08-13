import { describe, expect, it } from "vitest";
import {
  BURN_BASE_TICKS,
  BURN_CAP_TICKS,
  BUTTON_E,
  BUTTON_JUMP,
  FLAG_AIR_LAND,
  FLAG_LAND,
  VFX_PULSE_BOLT,
  VFX_PULSE_FIRE,
  VFX_PULSE_NONE,
  VFX_PULSE_PHYS,
} from "./constants";
import { ABILITY_FIRE, ABILITY_LIGHTNING, ABILITY_PHYSICAL } from "./loadout";
import { World } from "./world";

const SEED = 1;
const CONTENT = 0xc0ffee;

function hold(world: World, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step(mask);
}

function jumpUntilLand(world: World): void {
  world.step(BUTTON_JUMP);
  for (let i = 0; i < 200; i++) {
    world.step(0);
    if ((world.flags & FLAG_AIR_LAND) !== 0) return;
  }
  throw new Error("never landed");
}

describe("vfx landing pulses", () => {
  it("fires, bolts, and thumps only on jump land, from the up face", () => {
    const fire = new World({ seed: SEED, contentHash: CONTENT });
    fire.grant(ABILITY_FIRE);
    expect(fire.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0])).toBe(true);
    jumpUntilLand(fire);
    expect(fire.vfxPulse).toBe(VFX_PULSE_FIRE);
    expect(fire.burnDur).toBe(BURN_BASE_TICKS);
    expect(fire.scorchCount).toBe(1);

    const bolt = new World({ seed: SEED, contentHash: CONTENT });
    bolt.grant(ABILITY_LIGHTNING);
    expect(bolt.commitFaces([ABILITY_LIGHTNING, 0, 0, 0, 0, 0])).toBe(true);
    jumpUntilLand(bolt);
    expect(bolt.vfxPulse).toBe(VFX_PULSE_BOLT);
    expect(bolt.boltSeed).not.toBe(0);

    const phys = new World({ seed: SEED, contentHash: CONTENT });
    phys.grant(ABILITY_PHYSICAL);
    expect(phys.commitFaces([ABILITY_PHYSICAL, 0, 0, 0, 0, 0])).toBe(true);
    jumpUntilLand(phys);
    expect(phys.vfxPulse).toBe(VFX_PULSE_PHYS);
  });

  it("does not pulse on a roll land", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    world.grant(ABILITY_FIRE);
    world.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0]);
    hold(world, BUTTON_E, 23);
    world.step(0);
    expect((world.flags & FLAG_LAND) !== 0).toBe(true);
    expect((world.flags & FLAG_AIR_LAND) !== 0).toBe(false);
    expect(world.vfxPulse).toBe(VFX_PULSE_NONE);
    expect(world.burnDur).toBe(0);
  });

  it("re-ignite extends remaining burn up to the cap", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    world.grant(ABILITY_FIRE);
    world.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0]);
    jumpUntilLand(world);
    hold(world, 0, 120);
    jumpUntilLand(world);
    expect(world.burnDur).toBeGreaterThan(BURN_BASE_TICKS);
    expect(world.burnDur).toBeLessThanOrEqual(BURN_CAP_TICKS);
    expect(world.burnT).toBeLessThan(8);
  });
});
