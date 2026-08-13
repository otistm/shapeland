import {
  BUTTON_E,
  BUTTON_N,
  BUTTON_S,
  BUTTON_W,
  DIR_E,
  DIR_N,
  DIR_NONE,
  DIR_S,
  DIR_W,
} from "./constants";

export interface InputEvent {
  tick: number;
  mask: number;
}

export type InputLog = InputEvent[];

export function maskAt(log: InputLog, tick: number): number {
  let mask = 0;
  for (let i = 0; i < log.length; i++) {
    const ev = log[i];
    if (!ev || ev.tick > tick) break;
    mask = ev.mask;
  }
  return mask;
}

export function recordMask(log: InputLog, tick: number, mask: number): void {
  const last = log.length === 0 ? undefined : log[log.length - 1];
  if (last && last.mask === mask) return;
  if (last && last.tick === tick) {
    last.mask = mask;
    return;
  }
  log.push({ tick, mask });
}

export function cloneLog(log: InputLog): InputLog {
  const out: InputLog = [];
  for (let i = 0; i < log.length; i++) {
    const ev = log[i];
    if (ev) out.push({ tick: ev.tick, mask: ev.mask });
  }
  return out;
}

/** Dominant cardinal from a held mask. Opposites cancel. No analog diagonals. */
export function dirFromMask(mask: number): number {
  const x = ((mask & BUTTON_E) !== 0 ? 1 : 0) - ((mask & BUTTON_W) !== 0 ? 1 : 0);
  const z = ((mask & BUTTON_S) !== 0 ? 1 : 0) - ((mask & BUTTON_N) !== 0 ? 1 : 0);
  if (x === 0 && z === 0) return DIR_NONE;
  const ax = x < 0 ? -x : x;
  const az = z < 0 ? -z : z;
  if (ax >= az) return x > 0 ? DIR_E : DIR_W;
  return z > 0 ? DIR_S : DIR_N;
}
