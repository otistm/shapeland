import {
  BUTTON_ACT,
  BUTTON_DIR,
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

/**
 * Axis-lock an analog stick into a cardinal mask. Larger |component| wins and the
 * other is discarded; equal magnitudes prefer X, matching `dirFromMask`. `y` is
 * up-positive (north). Dead zone is inclusive (`>= dead` is live).
 */
export function analogToMask(x: number, y: number, dead: number): number {
  const ax = x < 0 ? -x : x;
  const ay = y < 0 ? -y : y;
  if (ax >= ay) {
    if (ax < dead) return 0;
    return x > 0 ? BUTTON_E : BUTTON_W;
  }
  if (ay < dead) return 0;
  return y > 0 ? BUTTON_N : BUTTON_S;
}

/**
 * Rotate view-space cardinals into world space by `yaw` quarter-turns (0..3).
 * Screen-up stays "into the camera look" so WASD never lies after a 90° cam turn.
 * Jump/pivot and any other non-dir bits pass through. Integer table — no trig.
 */
export function rotateDirMask(mask: number, yaw: number): number {
  const q = yaw & 3;
  if (q === 0) return mask;
  const act = mask & ~BUTTON_DIR;
  const n = (mask & BUTTON_N) !== 0;
  const e = (mask & BUTTON_E) !== 0;
  const s = (mask & BUTTON_S) !== 0;
  const w = (mask & BUTTON_W) !== 0;
  let dir = 0;
  if (q === 1) {
    if (n) dir |= BUTTON_E;
    if (e) dir |= BUTTON_S;
    if (s) dir |= BUTTON_W;
    if (w) dir |= BUTTON_N;
  } else if (q === 2) {
    if (n) dir |= BUTTON_S;
    if (e) dir |= BUTTON_W;
    if (s) dir |= BUTTON_N;
    if (w) dir |= BUTTON_E;
  } else {
    if (n) dir |= BUTTON_W;
    if (e) dir |= BUTTON_N;
    if (s) dir |= BUTTON_E;
    if (w) dir |= BUTTON_S;
  }
  return dir | act;
}

/** Touch dir beats pad dir beats keyboard dir. Jump/pivot bits OR together. */
export function mergeInputMasks(keyboard: number, touch: number, pad: number): number {
  const actions = (keyboard | touch | pad) & BUTTON_ACT;
  const touchDir = touch & BUTTON_DIR;
  if (touchDir !== 0) return touchDir | actions;
  const padDir = pad & BUTTON_DIR;
  if (padDir !== 0) return padDir | actions;
  return (keyboard & BUTTON_DIR) | actions;
}
