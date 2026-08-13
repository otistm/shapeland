/** CPU oracle for the blackbody fire ramp. TSL `fireRampFn` must match these mixes. */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix3(a: Rgb, b: Rgb, t: number): Rgb {
  return { r: mix(a.r, b.r, t), g: mix(a.g, b.g, t), b: mix(a.b, b.b, t) };
}

const SMOKE: Rgb = { r: 0.54, g: 0.52, b: 0.5 };
const EMBER: Rgb = { r: 0.55, g: 0.13, b: 0.02 };
const RED: Rgb = { r: 0.9, g: 0.26, b: 0.04 };
const ORANGE: Rgb = { r: 1, g: 0.55, b: 0.08 };
const YELLOW: Rgb = { r: 1, g: 0.83, b: 0.35 };
const WHITE: Rgb = { r: 1, g: 0.97, b: 0.88 };

/** Continuous blackbody-style ramp: smoke grey → ember → red → orange → yellow → near-white. */
export function fireRamp(T: number): Rgb {
  let c = mix3(SMOKE, EMBER, smoothstep(0.04, 0.18, T));
  c = mix3(c, RED, smoothstep(0.18, 0.38, T));
  c = mix3(c, ORANGE, smoothstep(0.38, 0.62, T));
  c = mix3(c, YELLOW, smoothstep(0.62, 0.82, T));
  return mix3(c, WHITE, smoothstep(0.82, 0.97, T));
}

export function luminance(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

/**
 * Disc erosion. Cooling shrinks the body and raises the tear threshold.
 * `d = r − (0.90 − 0.40(1−T)) + (0.52 − n)(0.60 + 0.85(1−T))`
 */
export function fireErosion(r: number, T: number, n: number): number {
  const cool = 1 - T;
  return r - (0.9 - 0.4 * cool) + (0.52 - n) * (0.6 + 0.85 * cool);
}

export function bodyRadius(T: number): number {
  return 0.9 - 0.4 * (1 - T);
}

export function tearGain(T: number): number {
  return 0.6 + 0.85 * (1 - T);
}

/** Lick stretch: monotone in speed, 1 at rest, saturating at 1 + 1.15. */
export function lickStretch(speed: number): number {
  const extra = speed * 0.22;
  return 1 + (extra < 1.15 ? extra : 1.15);
}

export function particleFade(T: number, age: number, bi: number, maxAge: number): number {
  const life = 1 - age / maxAge;
  const lifeC = life < 0 ? 0 : life;
  const heat = T > 0.16 ? (T * 3.2 < 1 ? T * 3.2 : 1) : 0.5 * (T / 0.16) * lifeC;
  const fade = heat < 0 ? 0 : heat;
  const env = bi * 1.6 + 0.25;
  return fade * (env < 1 ? env : 1);
}

/** Premultiplied fade: both RGB and A must reach 0 or the skirt stays on white. */
export function premultiply(c: Rgb, a: number): { r: number; g: number; b: number; a: number } {
  const alpha = a < 0 ? 0 : a > 1 ? 1 : a;
  return { r: c.r * alpha, g: c.g * alpha, b: c.b * alpha, a: alpha };
}
