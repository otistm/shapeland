import { describe, expect, it } from "vitest";
import {
  BUTTON_E,
  BUTTON_JUMP,
  BUTTON_N,
  BUTTON_PIVOT,
  BUTTON_W,
  DIR_E,
  DIR_N,
  DIR_NONE,
  FLAG_REFUSE,
  GRASS_ROLL_TICKS,
  JUMP_BUFFER_TICKS,
  MODE_CROUCH,
  MODE_IDLE,
  MODE_ROLL,
  MODE_TUCK,
  ROLL_TICKS,
  SWAMP_ROLL_TICKS,
} from "./constants";
import { dirFromMask } from "./input";
import { SimLoop } from "./loop";
import { assertMovement, proveMovement } from "./move-proof";
import { leapPose, twoRollPose } from "./movement";
import { DOWN, rollTowardDir } from "./orientation";
import { Terrain } from "./terrain";
import { World } from "./world";

const SEED = 1;
const CONTENT = 0xc0ffee;

function hold(world: World, mask: number, ticks: number): void {
  for (let i = 0; i < ticks; i++) world.step(mask);
}

function finishRoll(world: World, mask: number): void {
  hold(world, mask, ROLL_TICKS);
  world.step(0);
}

describe("movement proofs", () => {
  it("proves leap ≡ two rolls and the orientation lock", () => {
    const failed = proveMovement()
      .filter((line) => !line.ok)
      .map((line) => line.message);
    expect(failed).toEqual([]);
    expect(() => assertMovement()).not.toThrow();
  });

  it("matches leap and two rolls with exact integer equality", () => {
    for (let ori = 0; ori < 24; ori++) {
      for (const dir of [1, 2, 3, 4]) {
        const a = leapPose(3, -2, ori, dir);
        const b = twoRollPose(3, -2, ori, dir);
        expect(a).toEqual(b);
      }
    }
  });
});

describe("roll", () => {
  it("snaps to an integer cell and table orientation from roll start", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    finishRoll(world, BUTTON_E);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.x).toBe(1);
    expect(world.z).toBe(0);
    expect(world.orientation).toBe(rollTowardDir(0, DIR_E));
    expect(world.h).toBe(0);
  });

  it("chains a held direction with no idle gap", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    hold(world, BUTTON_E, ROLL_TICKS + 1);
    expect(world.mode).toBe(MODE_ROLL);
    expect(world.startX).toBe(1);
    expect(world.destX).toBe(2);
  });

  it("idles on the next land after the mask is released", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    hold(world, BUTTON_E, ROLL_TICKS + 1);
    expect(world.mode).toBe(MODE_ROLL);
    hold(world, 0, ROLL_TICKS);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.dir).toBe(DIR_NONE);
  });

  it("refuses walls, gaps, and |Δh| ≥ 2 cliffs without moving", () => {
    const terrain = new Terrain();
    terrain.setWall(1, 0);
    const walls = new World({ seed: SEED, contentHash: CONTENT, terrain });
    walls.step(BUTTON_E);
    expect(walls.x).toBe(0);
    expect(walls.mode).toBe(MODE_IDLE);
    expect(walls.flags & FLAG_REFUSE).toBe(FLAG_REFUSE);

    const gapped = new Terrain();
    gapped.setGap(1, 0);
    const gaps = new World({ seed: SEED, contentHash: CONTENT, terrain: gapped });
    gaps.step(BUTTON_E);
    expect(gaps.x).toBe(0);
    expect(gaps.flags & FLAG_REFUSE).toBe(FLAG_REFUSE);

    const stepped = new Terrain();
    stepped.setHeight(1, 0, 2);
    const cliff = new World({ seed: SEED, contentHash: CONTENT, terrain: stepped });
    cliff.step(BUTTON_E);
    expect(cliff.x).toBe(0);
    expect(cliff.flags & FLAG_REFUSE).toBe(FLAG_REFUSE);

    const stair = new Terrain();
    stair.setHeight(1, 0, 1);
    const up = new World({ seed: SEED, contentHash: CONTENT, terrain: stair });
    finishRoll(up, BUTTON_E);
    expect(up.x).toBe(1);
    expect(up.h).toBe(1);
  });
});

describe("water and swamp", () => {
  it("rolls onto water at dry tempo and refuses jump from wet cells", () => {
    const terrain = new Terrain();
    terrain.setWater(1, 0);
    const world = new World({ seed: SEED, contentHash: CONTENT, terrain });
    world.step(BUTTON_E);
    expect(world.mode).toBe(MODE_ROLL);
    expect(world.duration).toBe(ROLL_TICKS);
    hold(world, 0, ROLL_TICKS);
    expect(world.x).toBe(1);
    expect(world.mode).toBe(MODE_IDLE);
    world.step(BUTTON_JUMP);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.flags & FLAG_REFUSE).toBe(FLAG_REFUSE);
  });

  it("costs SWAMP_ROLL_TICKS to enter mud and still allows jump", () => {
    const terrain = new Terrain();
    terrain.setSwamp(1, 0);
    const world = new World({ seed: SEED, contentHash: CONTENT, terrain });
    world.step(BUTTON_E);
    expect(world.mode).toBe(MODE_ROLL);
    expect(world.duration).toBe(SWAMP_ROLL_TICKS);
    hold(world, 0, SWAMP_ROLL_TICKS);
    expect(world.x).toBe(1);
    expect(world.mode).toBe(MODE_IDLE);
    world.step(BUTTON_JUMP);
    expect(world.mode).toBe(MODE_CROUCH);
  });

  it("costs GRASS_ROLL_TICKS to enter meadow and still allows jump", () => {
    const terrain = new Terrain();
    terrain.setGrass(1, 0);
    const world = new World({ seed: SEED, contentHash: CONTENT, terrain });
    world.step(BUTTON_E);
    expect(world.mode).toBe(MODE_ROLL);
    expect(world.duration).toBe(GRASS_ROLL_TICKS);
    hold(world, 0, GRASS_ROLL_TICKS);
    expect(world.x).toBe(1);
    expect(world.mode).toBe(MODE_IDLE);
    world.step(BUTTON_JUMP);
    expect(world.mode).toBe(MODE_CROUCH);
  });
});

describe("jump and leap", () => {
  it("a tap jump lands on the same cell with the same orientation", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    world.step(BUTTON_JUMP);
    expect(world.mode).toBe(MODE_CROUCH);
    hold(world, 0, 200);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.x).toBe(0);
    expect(world.z).toBe(0);
    expect(world.orientation).toBe(0);
  });

  it("a held-direction leap lands on two-roll cell and orientation", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    const want = leapPose(0, 0, 0, DIR_E);
    world.step(BUTTON_JUMP | BUTTON_E);
    hold(world, BUTTON_E, 20);
    hold(world, 0, 200);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.x).toBe(want.x);
    expect(world.z).toBe(want.z);
    expect(world.orientation).toBe(want.ori);
  });

  it("buffered jump beats resuming a roll", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    world.step(BUTTON_E);
    expect(world.mode).toBe(MODE_ROLL);
    world.step(BUTTON_E | BUTTON_JUMP);
    expect(world.jumpBuf).toBe(JUMP_BUFFER_TICKS - 1);
    hold(world, BUTTON_E, ROLL_TICKS);
    expect(world.mode).toBe(MODE_CROUCH);
    expect(world.x).toBe(1);
  });

  it("leaps a one-cell gap and refuses a wall in the arc", () => {
    const gapT = new Terrain();
    gapT.setGap(1, 0);
    const over = new World({ seed: SEED, contentHash: CONTENT, terrain: gapT });
    over.step(BUTTON_JUMP | BUTTON_E);
    hold(over, BUTTON_E, 20);
    hold(over, 0, 200);
    expect(over.x).toBe(2);
    expect(over.orientation).toBe(leapPose(0, 0, 0, DIR_E).ori);

    const wallT = new Terrain();
    wallT.setWall(1, 0);
    const blocked = new World({ seed: SEED, contentHash: CONTENT, terrain: wallT });
    blocked.step(BUTTON_JUMP | BUTTON_E);
    hold(blocked, BUTTON_E, 20);
    hold(blocked, 0, 200);
    expect(blocked.x).toBe(0);
    expect(blocked.orientation).toBe(0);
  });
});

describe("pivot", () => {
  it("turns in place and restores a new down face", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    const before = DOWN(world.orientation);
    world.step(BUTTON_PIVOT);
    expect(world.pivotArmed).toBe(1);
    world.step(BUTTON_E);
    expect(world.mode).toBe(MODE_TUCK);
    hold(world, 0, 50);
    expect(world.mode).toBe(MODE_IDLE);
    expect(world.x).toBe(0);
    expect(world.z).toBe(0);
    expect(world.orientation).toBe(rollTowardDir(0, DIR_E));
    expect(DOWN(world.orientation)).not.toBe(before);
  });

  it("is one turn per press until the direction is released", () => {
    const world = new World({ seed: SEED, contentHash: CONTENT });
    world.step(BUTTON_PIVOT);
    hold(world, BUTTON_E, 80);
    expect(world.orientation).toBe(rollTowardDir(0, DIR_E));
    expect(world.mode).toBe(MODE_IDLE);
  });
});

describe("input lattice", () => {
  it("cancels opposite cardinals and never emits a diagonal", () => {
    expect(dirFromMask(BUTTON_E | BUTTON_W)).toBe(0);
    expect(dirFromMask(BUTTON_N | BUTTON_E)).toBe(DIR_E);
    expect(dirFromMask(BUTTON_N)).toBe(DIR_N);
  });
});

describe("replay under motion", () => {
  it("1-step frames and batched frames hash identically while rolling", () => {
    const a = new SimLoop({ seed: SEED, contentHash: CONTENT });
    const b = new SimLoop({ seed: SEED, contentHash: CONTENT });
    a.hold(BUTTON_E);
    b.hold(BUTTON_E);
    for (let i = 0; i < 24; i++) a.frame(1 / 120);
    b.frame((1 / 120) * 8);
    b.frame((1 / 120) * 8);
    b.frame((1 / 120) * 8);
    expect(a.cur.hashes.total).toBe(b.cur.hashes.total);
    expect(a.cur.player.x).toBe(b.cur.player.x);
    expect(a.world.mode).toBe(MODE_ROLL);
  });
});
