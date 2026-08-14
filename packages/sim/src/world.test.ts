import { describe, expect, it } from "vitest";
import {
  ABILITY_FIRE,
  ABILITY_LIGHTNING,
  BANNER_ZIG,
  BLANK_GAPS,
  BUTTON_N,
  DOWN,
  FLAG_LAND,
  MODE_IDLE,
  ROLL_TICKS,
  STAGE_RAISE,
  STAGE_SEEK,
  World,
  hurt,
  occupied,
  proveTerrain,
  proveWorld,
  regionOf,
  stampSlice,
  stepSlice,
  terraceHill,
} from "./index";
import { GLYPH, SHRINE, SOCKET, ZIG_SOCKET } from "./slice";
import { Terrain } from "./terrain";

const SEED = 1;
const CONTENT = 0xc0ffee;

function hold(world: World, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step(mask);
}

describe("terrain helpers", () => {
  it("builds a Chebyshev terrace whose peak is integer and sides are stairs", () => {
    const terrain = new Terrain();
    terraceHill(terrain, 0, 0, 3);
    expect(terrain.height(0, 0)).toBe(3);
    expect(terrain.height(1, 0)).toBe(2);
    expect(terrain.height(2, 2)).toBe(1);
    expect(terrain.height(3, 0)).toBe(0);
  });

  it("stamps The Blank bake east of start", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    expect(world.terrain.height(7, -3)).toBe(3);
    expect(world.terrain.height(6, -3)).toBe(2);
    const gap = BLANK_GAPS[0];
    expect(gap).toBeDefined();
    if (gap) expect(world.terrain.isGap(gap[0], gap[1])).toBe(true);
    expect(world.terrain.height(0, -7)).toBe(0);
  });
});

describe("slice occupancy", () => {
  it("keeps sentries and the Keeper out of the structural wall set", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    expect(world.terrain.isWall(2, -15)).toBe(false);
    expect(world.terrain.isWall(3, -5)).toBe(false);
    expect(world.terrain.isWall(0, -22)).toBe(false);
    expect(occupied(world, 2, -15)).toBe(true);
    expect(occupied(world, 3, -5)).toBe(true);
    expect(occupied(world, 0, -22)).toBe(true);
    world.doorOpen = 1;
    expect(occupied(world, 0, -22)).toBe(false);
    world.turretAlive = 0;
    expect(occupied(world, 2, -15)).toBe(false);
  });

  it("does not occupy the door on an empty world", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    expect(world.sliceOn).toBe(0);
    expect(occupied(world, 0, -22)).toBe(false);
  });
});

describe("shrine and socket", () => {
  it("stamps fire onto the down face and sets the respawn anchor", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    world.x = SHRINE.x;
    world.z = SHRINE.z;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.shrineTaken).toBe(1);
    expect(world.stage).toBe(STAGE_RAISE);
    expect(world.faces[DOWN(world.orientation)]).toBe(ABILITY_FIRE);
    expect(world.spawnZ).toBe(SHRINE.z);
    expect(world.found).not.toBe(0);
  });

  it("opens the door only with fire face-down on the socket", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    world.shrineTaken = 1;
    world.x = SOCKET.x;
    world.z = SOCKET.z;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.doorOpen).toBe(0);
    world.faces[DOWN(world.orientation)] = ABILITY_FIRE;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.doorOpen).toBe(1);
  });

  it("seals the ziggurat only with fire face-down", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    world.x = ZIG_SOCKET.x;
    world.z = ZIG_SOCKET.z;
    world.h = world.terrain.height(ZIG_SOCKET.x, ZIG_SOCKET.z);
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.zigTaken).toBe(0);
    world.faces[DOWN(world.orientation)] = ABILITY_FIRE;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.zigTaken).toBe(1);
    expect(world.banner).toBe(BANNER_ZIG);
  });

  it("grants lightning on the glyph after the door opens", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    world.doorOpen = 1;
    world.x = GLYPH.x;
    world.z = GLYPH.z;
    world.flags = FLAG_LAND;
    stepSlice(world);
    expect(world.glyphTaken).toBe(1);
    expect(world.faces[DOWN(world.orientation)]).toBe(ABILITY_LIGHTNING);
  });
});

describe("integrity", () => {
  it("hurts once per i-frame window and respawns at the shrine anchor", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    world.spawnX = SHRINE.x;
    world.spawnZ = SHRINE.z;
    world.x = 4;
    world.z = -15;
    hurt(world);
    expect(world.integrity).toBe(2);
    expect(world.iframes).toBeGreaterThan(0);
    hurt(world);
    expect(world.integrity).toBe(2);
    world.iframes = 0;
    hurt(world);
    world.iframes = 0;
    hurt(world);
    expect(world.x).toBe(SHRINE.x);
    expect(world.integrity).toBe(3);
    expect(world.mode).toBe(MODE_IDLE);
  });
});

describe("regions", () => {
  it("announces THE BLANK on the first tick at the origin", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT, slice: true });
    expect(world.stage).toBe(STAGE_SEEK);
    world.step(0);
    expect(world.region).toBe(0);
    expect(world.announced & 1).toBe(1);
  });

  it("keeps the chamber title behind the door", () => {
    expect(regionOf(0, -22, 0)).not.toBe(2);
    expect(regionOf(0, -22, 1)).toBe(2);
  });
});

describe("world proofs", () => {
  it("proves reachability, socket gating, and turret fairness", () => {
    const failed = proveWorld()
      .filter((line) => !line.ok)
      .map((line) => line.message);
    expect(failed).toEqual([]);
  });

  it("proves terrace construction, cliffs, and reachable summits", () => {
    const failed = proveTerrain()
      .filter((line) => !line.ok)
      .map((line) => line.message);
    expect(failed).toEqual([]);
  });
});

describe("empty world stays blank", () => {
  it("does not stamp the slice onto the default World", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    const terrain = new Terrain();
    stampSlice(terrain);
    expect(world.terrain.isGap(0, -12)).toBe(false);
    expect(terrain.isGap(0, -12)).toBe(true);
    hold(world, BUTTON_N, ROLL_TICKS + 1);
    expect(world.z).toBeLessThan(0);
    expect(world.found).toBe(0);
  });
});
