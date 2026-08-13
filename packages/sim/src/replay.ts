import { hex32 } from "./hash";
import { type InputLog, cloneLog, maskAt } from "./input";
import { SimLoop } from "./loop";
import type { LayeredHashes } from "./snapshot";

export const REPLAY_VERSION = 1;

export interface TickHash {
  tick: number;
  hashes: LayeredHashes;
}

export interface Replay {
  version: number;
  seed: number;
  contentHash: number;
  inputLog: InputLog;
  tickHashes: TickHash[];
}

export interface BugReport {
  seed: number;
  contentHash: string;
  inputLog: InputLog;
}

export function toBugReport(replay: Replay): BugReport {
  return {
    seed: replay.seed,
    contentHash: hex32(replay.contentHash),
    inputLog: cloneLog(replay.inputLog),
  };
}

export function recordReplay(
  seed: number,
  contentHash: number,
  ticks: number,
  inputLog: InputLog = [],
  hashEvery = 1,
): Replay {
  const loop = new SimLoop({ seed, contentHash });
  const tickHashes: TickHash[] = [];
  pushHash(loop, tickHashes);
  for (let t = 0; t < ticks; t++) {
    loop.stepTick(maskAt(inputLog, t + 1));
    if ((t + 1) % hashEvery === 0 || t + 1 === ticks) pushHash(loop, tickHashes);
  }
  return {
    version: REPLAY_VERSION,
    seed,
    contentHash,
    inputLog: cloneLog(inputLog),
    tickHashes,
  };
}

function pushHash(loop: SimLoop, out: TickHash[]): void {
  const h = loop.cur.hashes;
  out.push({
    tick: loop.tick,
    hashes: {
      player: h.player,
      rng: h.rng,
      world: h.world,
      input: h.input,
      total: h.total,
    },
  });
}

export interface ReplayMismatch {
  tick: number;
  layer: keyof LayeredHashes;
  expected: number;
  actual: number;
}

export function replayAndCheck(replay: Replay): ReplayMismatch | undefined {
  const loop = new SimLoop({ seed: replay.seed, contentHash: replay.contentHash });
  const byTick = new Map(replay.tickHashes.map((h) => [h.tick, h]));
  const maxTick = replay.tickHashes.reduce((m, h) => (h.tick > m ? h.tick : m), 0);
  const check = (): ReplayMismatch | undefined => {
    const expected = byTick.get(loop.tick);
    if (!expected) return undefined;
    const layers: (keyof LayeredHashes)[] = ["player", "rng", "world", "input", "total"];
    for (const layer of layers) {
      const actual = loop.cur.hashes[layer];
      const want = expected.hashes[layer];
      if (actual !== want) {
        return { tick: loop.tick, layer, expected: want, actual };
      }
    }
    return undefined;
  };
  const start = check();
  if (start) return start;
  for (let t = 0; t < maxTick; t++) {
    loop.stepTick(maskAt(replay.inputLog, t + 1));
    const mismatch = check();
    if (mismatch) return mismatch;
  }
  return undefined;
}

export function firstDivergentTick(a: Replay, b: Replay): number | undefined {
  const n = Math.min(a.tickHashes.length, b.tickHashes.length);
  for (let i = 0; i < n; i++) {
    const ha = a.tickHashes[i];
    const hb = b.tickHashes[i];
    if (!ha || !hb) return ha?.tick ?? hb?.tick;
    if (ha.hashes.total !== hb.hashes.total) return ha.tick;
  }
  if (a.tickHashes.length !== b.tickHashes.length) {
    const extra = a.tickHashes.length > b.tickHashes.length ? a.tickHashes : b.tickHashes;
    return extra[n]?.tick;
  }
  return undefined;
}
