import { INTEGRITY } from "./constants";
import { fnv1aI32, fnv1aStart, fnv1aU32 } from "./hash";
import { assertOrientationTables } from "./orientation";
import { type RngBank, copyRngBank, createRngBank, sfc32Next } from "./rng";
import { type SimSnapshot, createSnapshot } from "./snapshot";

export interface WorldConfig {
  seed: number;
  contentHash: number;
}

export class World {
  tick = 0;
  readonly seed: number;
  readonly contentHash: number;
  readonly player = new Int32Array(4);
  buttonMask = 0;
  integrity = INTEGRITY;
  readonly rng: RngBank;

  constructor(config: WorldConfig) {
    assertOrientationTables();
    this.seed = config.seed >>> 0;
    this.contentHash = config.contentHash >>> 0;
    this.rng = createRngBank(this.seed);
  }

  step(mask: number): void {
    this.tick += 1;
    this.buttonMask = mask | 0;
    sfc32Next(this.rng.world);
  }

  capture(out: SimSnapshot): void {
    out.tick = this.tick;
    out.seed = this.seed;
    out.contentHash = this.contentHash;
    out.integrity = this.integrity;
    out.player.x = this.player[0] ?? 0;
    out.player.y = this.player[1] ?? 0;
    out.player.z = this.player[2] ?? 0;
    out.player.orientation = this.player[3] ?? 0;
    out.hashes.player = hashPlayer(out.player);
    out.hashes.rng = hashRng(this.rng);
    out.hashes.world = hashWorld(this.contentHash, this.tick);
    out.hashes.input = fnv1aU32(fnv1aStart(), this.buttonMask);
    out.hashes.total = combineLayers(out.hashes);
  }

  snapshot(): SimSnapshot {
    const out = createSnapshot();
    this.capture(out);
    return out;
  }

  cloneRng(): RngBank {
    return copyRngBank(this.rng);
  }
}

function hashPlayer(p: { x: number; y: number; z: number; orientation: number }): number {
  let h = fnv1aStart();
  h = fnv1aI32(h, p.x);
  h = fnv1aI32(h, p.y);
  h = fnv1aI32(h, p.z);
  return fnv1aU32(h, p.orientation);
}

function hashRng(rng: RngBank): number {
  let h = fnv1aStart();
  h = fnv1aU32(h, rng.world.a);
  h = fnv1aU32(h, rng.world.b);
  h = fnv1aU32(h, rng.world.c);
  h = fnv1aU32(h, rng.world.d);
  h = fnv1aU32(h, rng.physics.a);
  h = fnv1aU32(h, rng.physics.b);
  h = fnv1aU32(h, rng.physics.c);
  h = fnv1aU32(h, rng.physics.d);
  h = fnv1aU32(h, rng.combat.a);
  h = fnv1aU32(h, rng.combat.b);
  h = fnv1aU32(h, rng.combat.c);
  return fnv1aU32(h, rng.combat.d);
}

function hashWorld(contentHash: number, tick: number): number {
  let h = fnv1aStart();
  h = fnv1aU32(h, contentHash);
  return fnv1aU32(h, tick);
}

function combineLayers(h: {
  player: number;
  rng: number;
  world: number;
  input: number;
}): number {
  let x = fnv1aStart();
  x = fnv1aU32(x, h.player);
  x = fnv1aU32(x, h.rng);
  x = fnv1aU32(x, h.world);
  return fnv1aU32(x, h.input);
}
