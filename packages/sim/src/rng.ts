/** Named sfc32 streams. One global RNG would desync every consumer on a call-count change. */

export interface Sfc32State {
  a: number;
  b: number;
  c: number;
  d: number;
}

export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

export function seedSfc32(seed: number, name: string): Sfc32State {
  const s = xmur3(`${seed >>> 0}:${name}`);
  return { a: s(), b: s(), c: s(), d: s() };
}

export function copySfc32(src: Sfc32State): Sfc32State {
  return { a: src.a, b: src.b, c: src.c, d: src.d };
}

/** Returns a uint32. Use this in sim; divide by 2^32 only at a call site that wants [0,1). */
export function sfc32Next(state: Sfc32State): number {
  let a = state.a | 0;
  let b = state.b | 0;
  let c = state.c | 0;
  let d = state.d | 0;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  state.a = a;
  state.b = b;
  state.c = c;
  state.d = d;
  return t >>> 0;
}

export const STREAM_NAMES = ["world", "physics", "combat"] as const;
export type StreamName = (typeof STREAM_NAMES)[number];

export type RngBank = Record<StreamName, Sfc32State>;

export function createRngBank(seed: number): RngBank {
  return {
    world: seedSfc32(seed, "world"),
    physics: seedSfc32(seed, "physics"),
    combat: seedSfc32(seed, "combat"),
  };
}

export function copyRngBank(bank: RngBank): RngBank {
  return {
    world: copySfc32(bank.world),
    physics: copySfc32(bank.physics),
    combat: copySfc32(bank.combat),
  };
}
