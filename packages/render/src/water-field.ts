import {
  ClampToEdgeWrapping,
  DataTexture,
  HalfFloatType,
  LinearFilter,
  NoColorSpace,
  RGBAFormat,
} from "three/webgpu";

const HALF_BUF = /* @__PURE__ */ new Float32Array(1);
const HALF_BITS = /* @__PURE__ */ new Uint32Array(HALF_BUF.buffer);

/**
 * IEEE 754 binary16 encoder (the algorithm three's own `DataUtils.toHalfFloat` uses; it is not in
 * the `three/webgpu` bundle). The field ships as half float on purpose — see `createWaterField`.
 */
export function toHalfFloat(value: number): number {
  HALF_BUF[0] = value;
  const x = HALF_BITS[0] ?? 0;
  const sign = (x >> 16) & 0x8000;
  const exp = (x >> 23) & 0xff;
  let mantissa = (x >> 12) & 0x07ff;
  if (exp < 103) return sign;
  if (exp > 142) return sign | 0x7c00;
  if (exp < 113) {
    mantissa |= 0x0800;
    return sign | ((mantissa >> (114 - exp)) + ((mantissa >> (113 - exp)) & 1));
  }
  return sign | ((((exp - 112) << 10) | (mantissa >> 1)) + (mantissa & 1));
}

/** Inverse of `toHalfFloat`. Exists so the packed field can be asserted, not eyeballed. */
export function fromHalfFloat(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exp = (bits >> 10) & 0x1f;
  const frac = bits & 0x03ff;
  if (exp === 0) return sign * 2 ** -24 * frac;
  if (exp === 31) return frac ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exp - 25) * (1024 + frac);
}

/**
 * Samples on a side. 8 per cell over `WATER_FIELD_CELLS`: at 4 per cell the cube spanned only
 * four texels, so its dimple was too coarse to read as a shape.
 */
export const WATER_FIELD_N = 128;
/** World cells covered by the local field, centered on the cube. */
export const WATER_FIELD_CELLS = 16;
export const WATER_FIELD_SPACING = WATER_FIELD_CELLS / WATER_FIELD_N;
/**
 * Rest surface above the cell floor. A unit cube's center sits at +0.5, so this is a real
 * waterline, not a film on the top face.
 */
export const WATER_SURFACE = 0.38;
/** Sphere that hugs the cube. Wallace couples a sphere; the cube is the same volume trick. */
export const WATER_CUBE_RADIUS = 0.52;
/** Splash radius and strengths, sized against the rolling wake in `water-probe`. */
export const WATER_SPLASH_R = 0.45;
export const WATER_SPLASH_ROLL = 0.8;
export const WATER_SPLASH_LAND = 1.3;
/**
 * Displaced volume per sample. Wallace uses 0.1 in a 2-unit pool where the sphere is a large
 * fraction of the surface; our cube sits in a 16-cell window, so at 0.1 the steady-state dimple
 * measured only 0.016 and was invisible next to the surface chop. Tuned against `water-probe`.
 */
export const WATER_VOLUME_SCALE = 0.22;
/** Beyond this many radii `volumeInSphere` is numerically zero, so the carve loop can stop. */
const VOLUME_REACH = 2.2;

const N = WATER_FIELD_N;
const COUNT = N * N;

/**
 * Wallace's `volumeInSphere`. A compact bump of height ~1 inside `radius`, then the slice of
 * that bump that intersects the rest plane. Render-only; `Math.exp` is legal here.
 */
export function volumeInSphere(
  sx: number,
  sz: number,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  waterY: number,
): number {
  const dx = sx - cx;
  const dz = sz - cz;
  const t = Math.sqrt(dx * dx + dz * dz) / radius;
  const u = t * 1.5;
  const u2 = u * u;
  const dy = Math.exp(-(u2 * u2 * u2));
  const localY = cy - waterY;
  const ymin = Math.min(0, localY - dy);
  const ymax = Math.min(Math.max(0, localY + dy), ymin + 2 * dy);
  return (ymax - ymin) * WATER_VOLUME_SCALE;
}

export interface WaterField {
  /** RGBA float: `(height, velocity, normal.x, normal.z)` — Wallace's texture layout exactly. */
  readonly texture: DataTexture;
  originX: number;
  originZ: number;
  /** Keep the window centered on the cube's cell so wakes stay in sample range. */
  recenter(cellX: number, cellZ: number): void;
  /**
   * Carve the cube's volume out of the field, restoring the previous pose. Same as
   * Wallace `moveSphere(oldCenter, newCenter, radius)`.
   */
  coupleCube(x: number, y: number, z: number, waterPlaneY: number, inWater: boolean): void;
  addDrop(x: number, z: number, radius: number, strength: number): void;
  /** Wave equation. Reduced motion keeps the dimple and freezes the ripples. */
  step(reduced: boolean): void;
  sample(x: number, z: number): number;
  /** Smooth height for buoyancy, so the bob does not step between texels. */
  sampleSmooth(x: number, z: number): number;
}

export function createWaterField(): WaterField {
  const h = new Float32Array(COUNT);
  const v = new Float32Array(COUNT);
  const scratchH = new Float32Array(COUNT);
  const scratchV = new Float32Array(COUNT);
  // Half float, not float32, and the reason is a hardware capability rather than a preference.
  // Wallace's demo needs `OES_texture_float` and falls back to `HALF_FLOAT_OES`; the modern
  // equivalents are the *optional* WebGPU feature `float32-filterable` and WebGL2's
  // `OES_texture_float_linear`. Without them three marks a float32 texture `unfilterable-float`,
  // and binding it to our LinearFilter sampler is a validation error — the puddle would simply
  // fail on those GPUs. `rgba16float` is filterable in core on both backends, and 11 bits of
  // mantissa is far more than a puddle heightfield needs.
  // `OES_standard_derivatives` needs no equivalent: `dFdx`/`dFdy` are core in GLSL ES 3.00 and
  // WGSL. We also never render *to* this texture, so no color-buffer-float feature is involved.
  const rgba = new Uint16Array(COUNT * 4);
  const texture = new DataTexture(rgba, N, N, RGBAFormat, HalfFloatType);
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = NoColorSpace;
  texture.needsUpdate = true;

  let originX = 0;
  let originZ = 0;
  let oldX = 0;
  let oldY = 0;
  let oldZ = 0;
  let hasOld = false;

  const at = (i: number, j: number): number => i + j * N;

  const worldX = (i: number): number => originX + (i + 0.5) * WATER_FIELD_SPACING;
  const worldZ = (j: number): number => originZ + (j + 0.5) * WATER_FIELD_SPACING;

  /** Only the texels the cube can actually reach; the rest of the grid contributes zero. */
  const applyVolume = (
    cx: number,
    cy: number,
    cz: number,
    radius: number,
    waterY: number,
    sign: number,
  ): void => {
    const reach = radius * VOLUME_REACH;
    const i0 = Math.max(0, Math.floor((cx - reach - originX) / WATER_FIELD_SPACING));
    const i1 = Math.min(N - 1, Math.ceil((cx + reach - originX) / WATER_FIELD_SPACING));
    const j0 = Math.max(0, Math.floor((cz - reach - originZ) / WATER_FIELD_SPACING));
    const j1 = Math.min(N - 1, Math.ceil((cz + reach - originZ) / WATER_FIELD_SPACING));
    for (let j = j0; j <= j1; j++) {
      const sz = worldZ(j);
      for (let i = i0; i <= i1; i++) {
        const vol = volumeInSphere(worldX(i), sz, cx, cy, cz, radius, waterY);
        h[at(i, j)] = (h[at(i, j)] ?? 0) + vol * sign;
      }
    }
  };

  /**
   * Wallace's `normalShader`: cross the two tangents and keep xz. `n.y` is recovered in the
   * shader as `sqrt(1 - dot(n.xz, n.xz))`, so only two channels travel.
   */
  const upload = (): void => {
    const s = WATER_FIELD_SPACING;
    for (let j = 0; j < N; j++) {
      for (let i = 0; i < N; i++) {
        const idx = at(i, j);
        const here = h[idx] ?? 0;
        const hx = (h[at(Math.min(i + 1, N - 1), j)] ?? 0) - here;
        const hz = (h[at(i, Math.min(j + 1, N - 1))] ?? 0) - here;
        const len = Math.sqrt(hx * hx + hz * hz + s * s);
        const o = idx * 4;
        rgba[o] = toHalfFloat(here);
        // Velocity stays CPU-side; the shader never reads it, so it costs no conversion.
        rgba[o + 2] = toHalfFloat(-hx / len);
        rgba[o + 3] = toHalfFloat(-hz / len);
      }
    }
    texture.needsUpdate = true;
  };

  return {
    texture,
    get originX() {
      return originX;
    },
    get originZ() {
      return originZ;
    },
    recenter(cellX, cellZ) {
      const nextX = cellX - (WATER_FIELD_CELLS >> 1);
      const nextZ = cellZ - (WATER_FIELD_CELLS >> 1);
      const dx = nextX - originX;
      const dz = nextZ - originZ;
      if (dx === 0 && dz === 0) return;
      const shift = Math.round(1 / WATER_FIELD_SPACING);
      const sx = dx * shift;
      const sz = dz * shift;
      scratchH.fill(0);
      scratchV.fill(0);
      for (let j = 0; j < N; j++) {
        const srcJ = j + sz;
        if (srcJ < 0 || srcJ >= N) continue;
        for (let i = 0; i < N; i++) {
          const srcI = i + sx;
          if (srcI < 0 || srcI >= N) continue;
          const dst = at(i, j);
          const src = at(srcI, srcJ);
          scratchH[dst] = h[src] ?? 0;
          scratchV[dst] = v[src] ?? 0;
        }
      }
      h.set(scratchH);
      v.set(scratchV);
      originX = nextX;
      originZ = nextZ;
    },
    coupleCube(x, y, z, waterPlaneY, inWater) {
      if (!inWater) {
        if (hasOld) {
          applyVolume(oldX, oldY, oldZ, WATER_CUBE_RADIUS, waterPlaneY, 1);
          hasOld = false;
        }
        return;
      }
      if (hasOld) applyVolume(oldX, oldY, oldZ, WATER_CUBE_RADIUS, waterPlaneY, 1);
      applyVolume(x, y, z, WATER_CUBE_RADIUS, waterPlaneY, -1);
      oldX = x;
      oldY = y;
      oldZ = z;
      hasOld = true;
    },
    addDrop(x, z, radius, strength) {
      const i0 = Math.max(0, Math.floor((x - radius - originX) / WATER_FIELD_SPACING));
      const i1 = Math.min(N - 1, Math.ceil((x + radius - originX) / WATER_FIELD_SPACING));
      const j0 = Math.max(0, Math.floor((z - radius - originZ) / WATER_FIELD_SPACING));
      const j1 = Math.min(N - 1, Math.ceil((z + radius - originZ) / WATER_FIELD_SPACING));
      for (let j = j0; j <= j1; j++) {
        const sz = worldZ(j);
        for (let i = i0; i <= i1; i++) {
          const ddx = worldX(i) - x;
          const ddz = sz - z;
          const dist = Math.sqrt(ddx * ddx + ddz * ddz);
          let drop = 1 - dist / radius;
          if (drop <= 0) continue;
          // Raised cosine, Wallace's `0.5 - cos(drop * π) * 0.5`.
          drop = 0.5 - Math.cos(drop * Math.PI) * 0.5;
          h[at(i, j)] = (h[at(i, j)] ?? 0) + drop * strength;
        }
      }
    },
    step(reduced) {
      if (!reduced) {
        for (let pass = 0; pass < 2; pass++) {
          scratchH.set(h);
          scratchV.set(v);
          for (let j = 1; j < N - 1; j++) {
            for (let i = 1; i < N - 1; i++) {
              const idx = at(i, j);
              const here = h[idx] ?? 0;
              const avg =
                ((h[at(i - 1, j)] ?? 0) +
                  (h[at(i + 1, j)] ?? 0) +
                  (h[at(i, j - 1)] ?? 0) +
                  (h[at(i, j + 1)] ?? 0)) *
                0.25;
              let vel = (v[idx] ?? 0) + (avg - here) * 2;
              vel *= 0.995;
              const next = here + vel;
              scratchV[idx] = vel;
              scratchH[idx] = next < -2 ? -2 : next > 2 ? 2 : next;
            }
          }
          h.set(scratchH);
          v.set(scratchV);
        }
      }
      upload();
    },
    sample(x, z) {
      const i = Math.floor((x - originX) / WATER_FIELD_SPACING);
      const j = Math.floor((z - originZ) / WATER_FIELD_SPACING);
      if (i < 0 || j < 0 || i >= N || j >= N) return 0;
      return h[at(i, j)] ?? 0;
    },
    sampleSmooth(x, z) {
      const fx = (x - originX) / WATER_FIELD_SPACING - 0.5;
      const fz = (z - originZ) / WATER_FIELD_SPACING - 0.5;
      const i = Math.floor(fx);
      const j = Math.floor(fz);
      if (i < 0 || j < 0 || i + 1 >= N || j + 1 >= N) return 0;
      const tx = fx - i;
      const tz = fz - j;
      const h00 = h[at(i, j)] ?? 0;
      const h10 = h[at(i + 1, j)] ?? 0;
      const h01 = h[at(i, j + 1)] ?? 0;
      const h11 = h[at(i + 1, j + 1)] ?? 0;
      const a = h00 + (h10 - h00) * tx;
      const b = h01 + (h11 - h01) * tx;
      return a + (b - a) * tz;
    },
  };
}
