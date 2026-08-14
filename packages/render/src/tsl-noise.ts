import { Fn, float, hash, mix, vec2 } from "three/tsl";

/**
 * Lattice bias. `hash()` feeds its seed through `uint()`, and `uint()` of a negative float is
 * undefined in both GLSL and WGSL — in practice it clamps, so every cell with a negative domain
 * hashes to the same value and the noise collapses to a flat constant. Shapeland's grid is
 * signed, so bias the integer lattice into positive territory before hashing.
 */
export const NOISE_LATTICE_BIAS = 4096;

/** Hash seed for an integer lattice corner. Never negative, by construction. */
export function latticeSeed(ix: number, iz: number): number {
  return ix + NOISE_LATTICE_BIAS + (iz + NOISE_LATTICE_BIAS) * 57;
}

/** The one value-noise definition in render. Integer PCG hash, never a sin/fract hash. */
function valueNoise(p: ReturnType<typeof vec2>): ReturnType<typeof float> {
  const i = p.floor().add(NOISE_LATTICE_BIAS);
  const f = p.fract();
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash(i.dot(vec2(1, 57)));
  const b = hash(i.add(vec2(1, 0)).dot(vec2(1, 57)));
  const c = hash(i.add(vec2(0, 1)).dot(vec2(1, 57)));
  const d = hash(i.add(vec2(1, 1)).dot(vec2(1, 57)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** Two octaves of PCG value-noise. Shared by fire and the wet surfaces so they cannot drift. */
export const fbm2 = /* @__PURE__ */ Fn(([p]: [ReturnType<typeof vec2>]) => {
  const octave = p.mul(2.07) as unknown as ReturnType<typeof vec2>;
  return valueNoise(p).mul(0.65).add(valueNoise(octave).mul(0.35));
});
