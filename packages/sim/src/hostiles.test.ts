import { describe, expect, it } from "vitest";
import {
  BANNER_CRACK,
  FLAG_AIR_LAND,
  FLAG_KILL,
  I_FRAMES_TICKS,
  TURRET_RANGE2,
  TURRET_STATE_AIM,
  TURRET_STATE_COOL,
} from "./constants";
import {
  HOSTILE_AIM_TICKS,
  HOSTILE_CHASE_TICKS,
  HOSTILE_CONE_SCOUT,
  HOSTILE_CONE_SPIRE,
  HOSTILE_CONE_WATCH,
  HOSTILE_COOL_TICKS,
  HOSTILE_SITES,
  HOSTILE_SPIKE_TICKS,
  HOSTILE_TETRA,
  HOSTILE_WATCH_RANGE2,
  hostileAimTicks,
  hostileRange2,
  stepHostiles,
  tetraSkipDir,
} from "./hostiles";
import { ABILITY_FIRE } from "./loadout";
import { UP } from "./orientation";
import { occupied } from "./slice";
import { World } from "./world";

describe("Blank hostiles", () => {
  it("occupies authored cells and frees them on death", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    const first = HOSTILE_SITES[0];
    expect(first?.[0]).toBe(HOSTILE_CONE_SCOUT);
    expect(occupied(world, first?.[1] ?? 0, first?.[2] ?? 0)).toBe(true);
    world.hostileAlive[0] = 0;
    expect(occupied(world, first?.[1] ?? 0, first?.[2] ?? 0)).toBe(false);
  });

  it("cracks a nearby hostile with a fire landing and leaves the cell open", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    const first = HOSTILE_SITES[0];
    world.x = (first?.[1] ?? 0) + 1;
    world.z = first?.[2] ?? 0;
    world.faces[UP(world.orientation)] = ABILITY_FIRE;
    world.flags = FLAG_AIR_LAND;
    stepHostiles(world);
    expect(world.hostileAlive[0]).toBe(0);
    expect((world.flags & FLAG_KILL) !== 0).toBe(true);
    expect(world.banner).toBe(BANNER_CRACK);
    expect(occupied(world, first?.[1] ?? 0, first?.[2] ?? 0)).toBe(false);
  });

  it("varies range by grammar, not hit points", () => {
    expect(hostileRange2(HOSTILE_CONE_SCOUT)).toBe(TURRET_RANGE2);
    expect(hostileRange2(HOSTILE_CONE_WATCH)).toBe(HOSTILE_WATCH_RANGE2);
    expect(hostileRange2(HOSTILE_CONE_SPIRE)).toBeGreaterThan(HOSTILE_WATCH_RANGE2);
    expect(hostileRange2(HOSTILE_TETRA)).toBeLessThan(TURRET_RANGE2);
  });

  it("keeps Blank cadence tight but still escapable and unable to double-hit", () => {
    expect(HOSTILE_AIM_TICKS).toBeGreaterThan(2 * 24);
    expect(HOSTILE_COOL_TICKS).toBeGreaterThan(I_FRAMES_TICKS);
    expect(hostileAimTicks(HOSTILE_CONE_SPIRE)).toBeGreaterThan(HOSTILE_AIM_TICKS);
    expect(HOSTILE_SPIKE_TICKS).toBeGreaterThan(0);
  });

  it("seeks the cube inside its watch radius and misses outside it", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    const first = HOSTILE_SITES[0];
    const hx = first?.[1] ?? 0;
    const hz = first?.[2] ?? 0;
    world.hostileState[0] = TURRET_STATE_AIM;
    world.hostileT[0] = HOSTILE_AIM_TICKS - 1;
    world.hostileTeleN[0] = 1;
    world.hostileTeleX[0] = 80;
    world.hostileTeleZ[0] = 80;
    world.x = hx + 4;
    world.z = hz;
    world.iframes = 0;
    world.integrity = 3;
    stepHostiles(world);
    expect(world.integrity).toBe(2);
    world.hostileState[0] = TURRET_STATE_AIM;
    world.hostileT[0] = HOSTILE_AIM_TICKS - 1;
    world.hostileTeleN[0] = 1;
    world.iframes = 0;
    world.x = hx + 8;
    world.z = hz;
    stepHostiles(world);
    expect(world.integrity).toBe(2);
  });

  it("hurts on a body check even when the cube left the highlighted cells", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    const first = HOSTILE_SITES[0];
    world.hostileState[0] = TURRET_STATE_AIM;
    world.hostileT[0] = HOSTILE_AIM_TICKS - 1;
    world.hostileTeleN[0] = 1;
    world.hostileTeleX[0] = 80;
    world.hostileTeleZ[0] = 80;
    world.x = (first?.[1] ?? 0) + 1;
    world.z = first?.[2] ?? 0;
    world.iframes = 0;
    world.integrity = 3;
    stepHostiles(world);
    expect(world.hostileState[0]).toBe(TURRET_STATE_COOL);
    expect(world.integrity).toBe(2);
    expect(world.hostileTeleN[0]).toBe(1);
  });

  it("hurts on the spike cells after the highlight, then clears them", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    world.hostileState[0] = TURRET_STATE_COOL;
    world.hostileT[0] = 0;
    world.hostileTeleN[0] = 1;
    world.hostileTeleX[0] = 12;
    world.hostileTeleZ[0] = 4;
    world.x = 12;
    world.z = 4;
    world.iframes = 0;
    world.integrity = 3;
    stepHostiles(world);
    expect(world.integrity).toBe(2);
    world.iframes = 0;
    world.hostileT[0] = HOSTILE_SPIKE_TICKS;
    world.hostileTeleN[0] = 1;
    stepHostiles(world);
    expect(world.hostileTeleN[0]).toBe(0);
  });

  it("makes the tetra's missing exit a function of the cell", () => {
    expect(tetraSkipDir(0, 0)).toBe(1);
    expect(tetraSkipDir(1, 0)).toBe(2);
    expect(tetraSkipDir(88, 16)).toBe(1 + ((88 + 16) & 3));
    const dirs = new Set<number>();
    for (let x = 0; x < 8; x++) dirs.add(tetraSkipDir(x, 0));
    expect(dirs.size).toBe(4);
  });

  it("chases the cube on the lattice and does not return to spawn", () => {
    const world = new World({ seed: 1, contentHash: 1, slice: true });
    const first = HOSTILE_SITES[0];
    const spawnX = first?.[1] ?? 0;
    const spawnZ = first?.[2] ?? 0;
    world.x = spawnX + 5;
    world.z = spawnZ;
    world.iframes = 200;
    for (let k = 0; k < HOSTILE_CHASE_TICKS * 5; k++) {
      world.tick += 1;
      stepHostiles(world);
    }
    expect(world.hostileX[0]).toBeGreaterThan(spawnX);
    expect(world.hostileX[0]).toBeLessThanOrEqual(spawnX + 5);
    const hunted = world.hostileX[0] ?? 0;
    world.x = spawnX + 80;
    world.z = spawnZ;
    for (let k = 0; k < HOSTILE_CHASE_TICKS * 4; k++) {
      world.tick += 1;
      stepHostiles(world);
    }
    expect(world.hostileX[0]).toBe(hunted);
  });
});
