import { TOON_BANDS } from "@shapeland/sim";

/** CPU oracle for the 3-texel nearest ramp. Band edges land at N·L = ±1/3. */
export function toonRampBytes(): Uint8Array {
  const data = new Uint8Array(TOON_BANDS.length * 4);
  for (let i = 0; i < TOON_BANDS.length; i++) {
    const v = Math.round((TOON_BANDS[i] ?? 0) * 255);
    const o = i * 4;
    data[o] = v;
    data[o + 1] = v;
    data[o + 2] = v;
    data[o + 3] = 255;
  }
  return data;
}

/**
 * Half-Lambert N·L mapped through 3 nearest texels.
 * `ndl` is the raw cosine; wrap is added after the 0.5 remap like the TSL node.
 */
export function sampleToonRamp(ndl: number, wrap = 0): number {
  const half = ndl * 0.5 + 0.5 + wrap;
  const t = half < 0 ? 0 : half > 0.9999 ? 0.9999 : half;
  const idx = Math.floor(t * TOON_BANDS.length);
  const band = TOON_BANDS[idx] ?? TOON_BANDS[TOON_BANDS.length - 1];
  return band ?? 1;
}
