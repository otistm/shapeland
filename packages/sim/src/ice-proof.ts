import {
  BUTTON_E,
  BUTTON_JUMP,
  BUTTON_PIVOT,
  DIR_E,
  KILL_RANGE2,
  MODE_IDLE,
  MODE_SLIDE,
  MODE_TUCK,
  REGION_CHAMBER,
  ROLL_TICKS,
} from "./constants";
import { iceHas, icePaint } from "./ice";
import { ABILITY_FIRE, ABILITY_ICE, axisClash } from "./loadout";
import { leapPose } from "./movement";
import { rollTowardDir } from "./orientation";
import type { ProofLine } from "./orientation-group";
import { GLYPH, ICE_GLYPH, NPC, regionOf } from "./slice";
import { Terrain } from "./terrain";
import { World } from "./world";
import { proveWorld } from "./world-proof";

const SEED = 1;
const CONTENT = 1;

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

function settle(world: World): void {
  for (let i = 0; i < 400; i++) {
    if (world.mode === MODE_IDLE) return;
    world.step(0);
  }
}

function finishRoll(world: World, mask: number): void {
  for (let i = 0; i < ROLL_TICKS; i++) world.step(mask);
  world.step(0);
}

function iceUp(world: World): void {
  world.grant(ABILITY_ICE);
  world.commitFaces([ABILITY_ICE, 0, 0, 0, 0, 0]);
}

function freezeHere(world: World): void {
  iceUp(world);
  world.step(BUTTON_JUMP);
  settle(world);
}

export function proveIce(): ProofLine[] {
  const lines: ProofLine[] = [];

  const freeze = new World({ seed: SEED, contentHash: CONTENT });
  freezeHere(freeze);
  let painted = 0;
  let missing = false;
  for (let dz = -2; dz <= 2; dz++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx * dx + dz * dz > KILL_RANGE2) continue;
      painted += 1;
      if (!iceHas(freeze.ice, freeze.iceCount, dx, dz)) missing = true;
    }
  }
  log(
    lines,
    !missing && freeze.iceCount === painted && painted === 21,
    `ice-up freeze paints ${freeze.iceCount} cells (want 21, same d² cutoff as fire)`,
  );

  const dry = new World({ seed: SEED, contentHash: CONTENT });
  finishRoll(dry, BUTTON_E);
  const oneRollOri = rollTowardDir(0, DIR_E);
  log(lines, dry.x === 1 && dry.orientation === oneRollOri, "one dry roll lands one cell east");

  const slick = new World({ seed: SEED, contentHash: CONTENT });
  freezeHere(slick);
  finishRoll(slick, BUTTON_E);
  log(
    lines,
    slick.mode === MODE_SLIDE && slick.x === 1 && slick.destX === 3 && slick.destOri === slick.startOri,
    `roll onto ice begins a slide (${slick.mode} dest ${slick.destX}, destOri=startOri)`,
  );
  settle(slick);
  log(
    lines,
    slick.x === 3 && slick.z === 0 && slick.orientation === oneRollOri && slick.mode === MODE_IDLE,
    `slide extra cells without extra quarter-turns (x=${slick.x} ori=${slick.orientation})`,
  );

  const leap = new World({ seed: SEED, contentHash: CONTENT });
  freezeHere(leap);
  const wantLeap = leapPose(0, 0, 0, DIR_E);
  leap.step(BUTTON_JUMP | BUTTON_E);
  for (let i = 0; i < 20; i++) leap.step(BUTTON_E);
  settle(leap);
  log(
    lines,
    leap.x === wantLeap.x && leap.z === wantLeap.z && leap.orientation === wantLeap.ori,
    `leap onto ice does not slide (landed ${leap.x},${leap.z})`,
  );

  const terrain = new Terrain();
  terrain.setWall(2, 0);
  const walled = new World({ seed: SEED, contentHash: CONTENT, terrain });
  freezeHere(walled);
  finishRoll(walled, BUTTON_E);
  settle(walled);
  log(lines, walled.x === 1 && walled.mode === MODE_IDLE, "a wall stops the slide on the last valid cell");

  const blocked = new World({ seed: SEED, contentHash: CONTENT, slice: true });
  blocked.x = 1;
  blocked.z = NPC.z;
  blocked.h = 0;
  icePaint(blocked, 2, NPC.z);
  finishRoll(blocked, BUTTON_E);
  settle(blocked);
  log(
    lines,
    blocked.x === 2 && blocked.z === NPC.z,
    "Keeper occupancy stops the slide the same way a wall does",
  );

  const melt = new World({ seed: SEED, contentHash: CONTENT });
  freezeHere(melt);
  melt.grant(ABILITY_FIRE);
  melt.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0]);
  melt.step(BUTTON_JUMP);
  settle(melt);
  log(
    lines,
    !iceHas(melt.ice, melt.iceCount, 0, 0) && iceHas(melt.ice, melt.iceCount, 1, 0) && melt.scorchCount === 1,
    "fire scorch melts only the scorched ice cell",
  );

  const clear = new World({ seed: SEED, contentHash: CONTENT });
  clear.grant(ABILITY_FIRE);
  clear.commitFaces([ABILITY_FIRE, 0, 0, 0, 0, 0]);
  clear.step(BUTTON_JUMP);
  settle(clear);
  iceUp(clear);
  clear.step(BUTTON_JUMP);
  settle(clear);
  log(
    lines,
    clear.scorchCount === 0 && iceHas(clear.ice, clear.iceCount, 0, 0),
    "ice paint clears scorch on the same cell",
  );

  const pivot = new World({ seed: SEED, contentHash: CONTENT });
  freezeHere(pivot);
  pivot.step(BUTTON_PIVOT);
  pivot.step(BUTTON_E);
  log(lines, pivot.mode === MODE_TUCK && pivot.x === 0, "pivot on ice stays in place");
  settle(pivot);
  log(lines, pivot.x === 0 && pivot.z === 0, "pivot landing does not slide");

  log(
    lines,
    axisClash([ABILITY_FIRE, ABILITY_ICE, 0, 0, 0, 0]) &&
      !axisClash([ABILITY_FIRE, 0, ABILITY_ICE, 0, 0, 0]),
    "Fire|Ice on an axis is a clash; adjacent faces are not",
  );

  log(
    lines,
    ICE_GLYPH.x === 2 &&
      ICE_GLYPH.z === -26 &&
      regionOf(ICE_GLYPH.x, ICE_GLYPH.z, 1) === REGION_CHAMBER &&
      !(ICE_GLYPH.x === GLYPH.x && ICE_GLYPH.z === GLYPH.z),
    "optional ice glyph sits inside the chamber, off the lightning cell",
  );

  const pins = proveWorld();
  log(
    lines,
    pins.every((line) => line.ok),
    "socket BFS pins unchanged after Ice",
  );

  return lines;
}

export function assertIce(): void {
  const failed = proveIce().filter((line) => !line.ok);
  if (failed.length) throw new Error(failed.map((line) => line.message).join("\n"));
}
