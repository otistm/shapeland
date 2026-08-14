import { HalfFloatType } from "three/webgpu";
import { describe, expect, it } from "vitest";
import {
  WATER_CUBE_RADIUS,
  WATER_SPLASH_LAND,
  WATER_SPLASH_R,
  WATER_SPLASH_ROLL,
  WATER_SURFACE,
  createWaterField,
  fromHalfFloat,
  toHalfFloat,
  volumeInSphere,
} from "./water-field";

/** What `world-view.present` does every frame, so amplitudes are measured on the real path. */
function rollAcross(cells: number): { field: ReturnType<typeof createWaterField>; x: number } {
  const field = createWaterField();
  let x = 0;
  const frame = () => {
    field.recenter(Math.round(x), 0);
    field.coupleCube(x, 0.5, 0, WATER_SURFACE, true);
    field.step(false);
  };
  frame();
  for (let cell = 0; cell < cells; cell++) {
    // ROLL_DUR .19 is about 11 frames at 60fps.
    for (let f = 0; f < 11; f++) {
      x += 1 / 11;
      frame();
    }
  }
  return { field, x };
}

function extent(field: ReturnType<typeof createWaterField>, cx: number, cz: number): number {
  let lo = 0;
  let hi = 0;
  for (let dx = -4; dx <= 4; dx += 0.25) {
    for (let dz = -4; dz <= 4; dz += 0.25) {
      const h = field.sample(cx + dx, cz + dz);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  return hi - lo;
}

describe("wallace cube-water coupling", () => {
  it("carves a dimple under the cube and restores it when the cube leaves", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.coupleCube(0, 0.5, 0, WATER_SURFACE, true);
    field.step(true);
    const dimple = field.sample(0, 0);
    expect(dimple).toBeLessThan(-0.04);
    expect(field.sample(3, 3)).toBeGreaterThan(dimple);
    field.coupleCube(0, 0.5, 0, WATER_SURFACE, false);
    field.step(true);
    expect(Math.abs(field.sample(0, 0))).toBeLessThan(0.001);
  });

  it("leaves a wake when the cube translates, like Wallace moveSphere", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.coupleCube(0, 0.5, 0, WATER_SURFACE, true);
    field.coupleCube(0.6, 0.5, 0, WATER_SURFACE, true);
    field.step(true);
    expect(field.sample(0.6, 0)).toBeLessThan(field.sample(-0.6, 0));
  });

  it("throws a wake big enough to see when the cube rolls, on the real per-frame path", () => {
    // The defect: measured only on the frozen path, the coupling looked fine, but running the
    // wave equation every frame drained it to ±0.016 — invisible next to the surface chop.
    // Amplitudes here are relative to WATER_SURFACE (0.38), the depth of the puddle.
    const { field, x } = rollAcross(5);
    const moving = extent(field, x, 0);
    expect(moving).toBeGreaterThan(0.08);
    // ...and not so violent that water erupts past the puddle depth.
    expect(moving).toBeLessThan(WATER_SURFACE * 2);
  });

  it("lets the wake settle instead of ringing forever", () => {
    const { field, x } = rollAcross(5);
    const moving = extent(field, x, 0);
    for (let i = 0; i < 30; i++) {
      field.recenter(Math.round(x), 0);
      field.coupleCube(x, 0.5, 0, WATER_SURFACE, true);
      field.step(false);
    }
    const settling = extent(field, x, 0);
    expect(settling).toBeLessThan(moving);
    expect(settling).toBeGreaterThan(0);
  });

  it("makes a roll-entry splash comparable to the rolling wake", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.addDrop(0, 0, WATER_SPLASH_R, WATER_SPLASH_ROLL);
    for (let i = 0; i < 8; i++) field.step(false);
    expect(extent(field, 0, 0)).toBeGreaterThan(0.08);
    expect(WATER_SPLASH_LAND).toBeGreaterThan(WATER_SPLASH_ROLL);
  });

  it("keeps wave energy bounded after a drop", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.addDrop(0, 0, 0.45, 0.08);
    const peak0 = Math.abs(field.sample(0, 0));
    expect(peak0).toBeGreaterThan(0.04);
    for (let i = 0; i < 240; i++) field.step(false);
    const peak = Math.abs(field.sample(0, 0));
    expect(peak).toBeLessThan(peak0 * 1.8);
    expect(Number.isFinite(peak)).toBe(true);
  });

  it("publishes normals that tilt away from the dimple, Wallace's texture layout", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.coupleCube(0, 0.5, 0, WATER_SURFACE, true);
    field.step(true);
    const data = field.texture.image.data as Uint16Array;
    const n = Math.sqrt(data.length / 4);
    const texel = (i: number, j: number) => {
      const o = (i + j * n) * 4;
      return {
        h: fromHalfFloat(data[o] ?? 0),
        nx: fromHalfFloat(data[o + 2] ?? 0),
        nz: fromHalfFloat(data[o + 3] ?? 0),
      };
    };
    const mid = n >> 1;
    // Walls of the well face outward, so nx flips sign across the dimple.
    const left = texel(mid - 4, mid);
    const right = texel(mid + 4, mid);
    expect(Math.sign(left.nx)).not.toBe(Math.sign(right.nx));
    // A unit normal never has an xz part longer than 1, or sqrt() in the shader goes imaginary.
    for (const t of [left, right, texel(mid, mid)]) {
      expect(t.nx * t.nx + t.nz * t.nz).toBeLessThanOrEqual(1);
    }
  });

  it("samples smoothly for buoyancy so the bob does not step between texels", () => {
    const field = createWaterField();
    field.recenter(0, 0);
    field.addDrop(0, 0, 0.6, 0.09);
    field.step(true);
    const a = field.sampleSmooth(0.01, 0);
    const b = field.sampleSmooth(0.02, 0);
    expect(Math.abs(a - b)).toBeLessThan(0.01);
    expect(field.sampleSmooth(500, 500)).toBe(0);
  });

  it("ships a filterable texture type, because float32 filtering is optional hardware", () => {
    // Wallace needs OES_texture_float and falls back to HALF_FLOAT_OES. The modern equivalent is
    // the optional WebGPU feature `float32-filterable`: without it three marks a float32 texture
    // `unfilterable-float`, and our LinearFilter sampler then fails validation. rgba16float is
    // filterable in core on both WebGPU and WebGL2, so the puddle cannot fall off a capability.
    const field = createWaterField();
    expect(field.texture.type).toBe(HalfFloatType);
    expect(field.texture.image.data).toBeInstanceOf(Uint16Array);
  });

  it("round-trips field magnitudes through half float without visible loss", () => {
    for (const value of [0, 0.0125, -0.0125, 0.38, -0.16, 1, -1, 2, -2]) {
      expect(fromHalfFloat(toHalfFloat(value))).toBeCloseTo(value, 3);
    }
    // Normals are unit-length, so half float's worst case near 1.0 is ~5e-4 — invisible in shading.
    const diagonal = Math.SQRT1_2;
    expect(Math.abs(fromHalfFloat(toHalfFloat(diagonal)) - diagonal)).toBeLessThan(1e-3);
  });

  it("uses Wallace's sphere slice, zero far from the cube", () => {
    const at = volumeInSphere(0, 0, 0, 0.5, 0, WATER_CUBE_RADIUS, WATER_SURFACE);
    const far = volumeInSphere(4, 4, 0, 0.5, 0, WATER_CUBE_RADIUS, WATER_SURFACE);
    expect(at).toBeGreaterThan(0.05);
    expect(far).toBeLessThan(1e-6);
  });
});
