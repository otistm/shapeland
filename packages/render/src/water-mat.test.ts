import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GRASS, ICE, SWAMP, WATER } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./palette";
import { NOISE_LATTICE_BIAS, latticeSeed } from "./tsl-noise";
import { WATER_ALPHA, WATER_CREST_ADD, WATER_SHALLOW } from "./water-mat";

const RENDER_SRC = dirname(fileURLToPath(import.meta.url));

function linearToHex(rgb: readonly [number, number, number]): string {
  const to = (c: number) => {
    const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(s * 255)));
  };
  const n = (to(rgb[0]) << 16) | (to(rgb[1]) << 8) | to(rgb[2]);
  return `#${n.toString(16).padStart(6, "0")}`;
}

describe("qa-vfx wet surface readability", () => {
  it("reads as a wet sheet on white without relying on motion", () => {
    expect(contrastRatio(WATER, "#ffffff")).toBeGreaterThan(1.6);
    expect(contrastRatio(SWAMP, "#ffffff")).toBeGreaterThan(1.6);
    expect(contrastRatio(GRASS, "#ffffff")).toBeGreaterThan(1.6);
    expect(contrastRatio(WATER, ICE)).toBeGreaterThan(1.2);
    expect(WATER).not.toBe(ICE);
    expect(GRASS).not.toBe(SWAMP);
    const [gr, gg] = [
      Number.parseInt(GRASS.slice(1, 3), 16),
      Number.parseInt(GRASS.slice(3, 5), 16),
    ];
    expect(gg).toBeGreaterThan(gr);
  });

  it("keeps the moving crest a mid-value teal, not near-white and not ice", () => {
    const crest = [
      (WATER_SHALLOW[0] ?? 0) + (WATER_CREST_ADD[0] ?? 0),
      (WATER_SHALLOW[1] ?? 0) + (WATER_CREST_ADD[1] ?? 0),
      (WATER_SHALLOW[2] ?? 0) + (WATER_CREST_ADD[2] ?? 0),
    ] as const;
    const hex = linearToHex(crest);
    // Near-white is reserved for the background, so even the brightest ripple stays separated.
    expect(contrastRatio(hex, "#ffffff")).toBeGreaterThan(1.25);
    expect(contrastRatio(hex, ICE)).toBeGreaterThan(1.1);
    expect(crest[2]).toBeGreaterThan(crest[0]);
    expect(WATER_ALPHA).toBeGreaterThan(0.8);
  });
});

describe("qa-vfx wet surface mechanisms", () => {
  it("biases the noise lattice so signed cells cannot collapse to one hash", () => {
    // hash() seeds through uint(); uint() of a negative float is undefined in GLSL and WGSL, so an
    // unbiased lattice made every negative-z cell hash identically and the sheet went flat.
    const signed: Array<[number, number]> = [
      [-5, -6],
      [-6, -6],
      [10, -2],
      [10, -3],
      [13, 3],
      [-14, -10],
    ];
    const seeds = signed.map(([x, z]) => latticeSeed(x, z));
    for (const seed of seeds) expect(seed).toBeGreaterThan(0);
    expect(new Set(seeds).size).toBe(seeds.length);
    expect(NOISE_LATTICE_BIAS).toBeGreaterThan(512);

    const src = readFileSync(join(RENDER_SRC, "tsl-noise.ts"), "utf8");
    expect(src.includes("p.floor().add(NOISE_LATTICE_BIAS)")).toBe(true);
  });

  it("drives the sheet from the instance cell and one stage only", () => {
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    const imports = src.slice(0, src.indexOf('} from "three/tsl";'));
    // positionWorld derives from positionLocal, so a sheet reading it is self-referential, and a
    // vertex stage at all would put the clock in a second UBO that WebGL2 never re-uploads.
    expect(imports.includes("positionWorld")).toBe(false);
    expect(imports.includes("positionLocal")).toBe(false);
    // TSL `time` lives in the shared render group, which does not advance on the WebGL2 fallback.
    expect(/\btime\b/.test(imports)).toBe(false);
    expect(src.includes("positionNode")).toBe(false);
    // A plain `.value` write leaves the object UBO clean; three's own `time` uses this hook.
    expect(src.includes("onFrameUpdate")).toBe(true);
    expect(src.includes('attribute("aCell", "vec2")')).toBe(true);
  });

  it("keeps the clock render-owned so reduced motion is a frozen, readable frame", () => {
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("water.setClock(reduced ? 0 : clock)")).toBe(true);
    expect(view.includes("grass.setClock(reduced ? 0 : clock)")).toBe(true);
    expect(view.includes("grass.setLean")).toBe(true);
    expect(view.includes("MODE_ROLL")).toBe(true);
  });
});
