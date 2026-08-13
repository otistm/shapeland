import {
  BURN_BASE_TICKS,
  BURN_CAP_TICKS,
  BURN_IN_TICKS,
  BURN_OUT,
  FIRE_MAX,
  FLAG_AIR_LAND,
  FLAG_LAND,
  SCORCH_MAX,
  VFX_PULSE_BOLT,
  VFX_PULSE_FIRE,
  VFX_PULSE_NONE,
  VFX_PULSE_PHYS,
} from "./constants";
import type { FireField } from "./fire";
import { fnv1aF64, fnv1aStart, fnv1aU32 } from "./hash";
import { ABILITY_FIRE, ABILITY_LIGHTNING, ABILITY_PHYSICAL } from "./loadout";
import { UP } from "./orientation";
import { type RngBank, sfc32Next } from "./rng";
import { packXZ } from "./terrain";

export interface VfxHost {
  x: number;
  h: number;
  z: number;
  orientation: number;
  flags: number;
  faces: Uint8Array;
  burnT: number;
  burnDur: number;
  vfxPulse: number;
  boltSeed: number;
  fire: FireField;
  scorch: Uint32Array;
  scorchH: Int8Array;
  scorchCount: number;
  scorchHash: number;
  rng: RngBank;
}

export function burnIntensity(burnT: number, burnDur: number): number {
  if (burnDur <= 0) return 0;
  const k = burnT / burnDur;
  const inRamp = burnT / BURN_IN_TICKS;
  const inC = inRamp > 1 ? 1 : inRamp;
  const outRamp = (1 - k) / BURN_OUT;
  const outC = outRamp > 1 ? 1 : outRamp;
  const v = inC * outC;
  return v < 0 ? 0 : v;
}

export function ignite(w: VfxHost): void {
  const remain = w.burnDur - w.burnT;
  const left = remain < 0 ? 0 : remain;
  let dur = left + BURN_BASE_TICKS;
  if (dur > BURN_CAP_TICKS) dur = BURN_CAP_TICKS;
  w.burnDur = dur;
  w.burnT = 0;
}

function markScorch(w: VfxHost, x: number, z: number, h: number): void {
  const key = packXZ(x, z) >>> 0;
  for (let i = 0; i < w.scorchCount; i++) {
    if (w.scorch[i] === key) return;
  }
  if (w.scorchCount >= SCORCH_MAX) return;
  const i = w.scorchCount;
  w.scorch[i] = key;
  w.scorchH[i] = h | 0;
  w.scorchCount = i + 1;
  w.scorchHash = fnv1aU32(w.scorchHash === 0 ? fnv1aStart() : w.scorchHash, key);
}

function abilityOnUp(w: VfxHost): number {
  return w.faces[UP(w.orientation)] ?? 0;
}

export function stepVfx(w: VfxHost): void {
  w.vfxPulse = VFX_PULSE_NONE;
  if ((w.flags & FLAG_AIR_LAND) !== 0) {
    const kind = abilityOnUp(w);
    if (kind === ABILITY_FIRE) {
      ignite(w);
      w.vfxPulse = VFX_PULSE_FIRE;
      markScorch(w, w.x, w.z, w.h);
    } else if (kind === ABILITY_LIGHTNING) {
      w.vfxPulse = VFX_PULSE_BOLT;
      w.boltSeed = sfc32Next(w.rng.combat);
    } else if (kind === ABILITY_PHYSICAL) {
      w.vfxPulse = VFX_PULSE_PHYS;
    }
  }

  const bi = burnIntensity(w.burnT, w.burnDur);
  if ((w.flags & FLAG_LAND) !== 0 && bi > 0.05) markScorch(w, w.x, w.z, w.h);

  if (w.burnDur > 0) {
    w.burnT += 1;
    if (w.burnT >= w.burnDur) {
      w.burnDur = 0;
      w.burnT = 0;
    }
  }

  w.fire.step(bi, w.h, w.x, w.z, w.rng.physics);
}

export function hashFire(fire: FireField): number {
  let h = fnv1aU32(fnv1aStart(), fire.count);
  for (let i = 0; i < fire.count; i++) {
    h = fnv1aF64(h, fire.x[i] ?? 0);
    h = fnv1aF64(h, fire.y[i] ?? 0);
    h = fnv1aF64(h, fire.z[i] ?? 0);
    h = fnv1aF64(h, fire.T[i] ?? 0);
  }
  return h;
}

export function copyFireLive(
  fire: FireField,
  x: Float32Array,
  y: Float32Array,
  z: Float32Array,
  T: Float32Array,
  size: Float32Array,
  stretch: Float32Array,
  fade: Float32Array,
  seed: Float32Array,
): number {
  const n = fire.count < FIRE_MAX ? fire.count : FIRE_MAX;
  for (let i = 0; i < n; i++) {
    x[i] = fire.x[i] ?? 0;
    y[i] = fire.y[i] ?? 0;
    z[i] = fire.z[i] ?? 0;
    T[i] = fire.T[i] ?? 0;
    size[i] = fire.size[i] ?? 0;
    stretch[i] = fire.stretch[i] ?? 0;
    fade[i] = fire.fade[i] ?? 0;
    seed[i] = fire.seed[i] ?? 0;
  }
  return n;
}
