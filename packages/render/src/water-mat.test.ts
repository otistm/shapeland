import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GRASS, ICE, SWAMP, WATER } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./palette";
import { NOISE_LATTICE_BIAS, latticeSeed } from "./tsl-noise";
import {
  IOR_AIR,
  IOR_WATER,
  WATER_ALPHA,
  WATER_CAUSTIC_ADD,
  WATER_CREST_ADD,
  WATER_ETA,
  WATER_SHALLOW,
  WATER_SPEC_ADD,
  WATER_SURFACE_ALPHA,
} from "./water-mat";

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
    const peak = [
      (WATER_SHALLOW[0] ?? 0) +
        (WATER_CREST_ADD[0] ?? 0) +
        (WATER_CAUSTIC_ADD[0] ?? 0) +
        (WATER_SPEC_ADD[0] ?? 0),
      (WATER_SHALLOW[1] ?? 0) +
        (WATER_CREST_ADD[1] ?? 0) +
        (WATER_CAUSTIC_ADD[1] ?? 0) +
        (WATER_SPEC_ADD[1] ?? 0),
      (WATER_SHALLOW[2] ?? 0) +
        (WATER_CREST_ADD[2] ?? 0) +
        (WATER_CAUSTIC_ADD[2] ?? 0) +
        (WATER_SPEC_ADD[2] ?? 0),
    ] as const;
    const hex = linearToHex(peak);
    // Near-white is reserved for the background, so even the brightest caustic stays separated.
    expect(contrastRatio(hex, "#ffffff")).toBeGreaterThan(1.25);
    expect(contrastRatio(hex, ICE)).toBeGreaterThan(1.1);
    expect(peak[2]).toBeGreaterThan(peak[0]);
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
    // positionWorld derives from positionLocal, so a sheet reading it as the noise domain while
    // assigning positionNode is self-referential. Displacement offsets positionLocal; noise stays
    // on aCell + uv(). The clock still must not enter the vertex stage (WebGL2 dual-UBO freeze).
    expect(imports.includes("positionWorld")).toBe(false);
    expect(imports.includes("positionLocal")).toBe(true);
    // TSL `time` lives in the shared render group, which does not advance on the WebGL2 fallback.
    expect(/\btime\b/.test(imports)).toBe(false);
    expect(src.includes("positionNode")).toBe(true);
    const posAssign = src.slice(src.indexOf("positionNode"), src.indexOf("positionNode") + 80);
    expect(posAssign.includes("clock")).toBe(false);
    // A plain `.value` write leaves the object UBO clean; three's own `time` uses this hook.
    expect(src.includes("onFrameUpdate")).toBe(true);
    expect(src.includes('attribute("aCell", "vec2")')).toBe(true);
  });

  it("focuses light with a world-xz Jacobian, never screen-space derivatives", () => {
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    expect(src.includes("refract(")).toBe(true);
    expect(src.includes("landedAt(")).toBe(true);
    expect(src.includes("WATER_FIELD_SPACING")).toBe(true);
    expect(src.includes("oldArea")).toBe(true);
    expect(src.includes("newArea")).toBe(true);
    // Screen-space dFdx/dFdy follow the camera's pixel axes (diagonal under the quarter-turn
    // yaw) and jump at triangle edges — that was the hatching. Wallace samples a caustic
    // texture; we evaluate the same mapping as a function of floor xz.
    expect(src.includes("dFdx(")).toBe(false);
    expect(src.includes("dFdy(")).toBe(false);
    expect(IOR_AIR / IOR_WATER).toBeCloseTo(WATER_ETA);
    expect(WATER_ETA).toBeCloseTo(0.75, 2);
    expect(src.includes("positionNode")).toBe(true);
    const posAssign = src.slice(src.indexOf("positionNode"), src.indexOf("positionNode") + 80);
    expect(posAssign.includes("clock")).toBe(false);
  });

  it("shades from the heightfield, not from the noise swell alone", () => {
    // The defect: the surface normal came from fbm2 while the geometry was displaced by the
    // field, so the cube's dimple and its wake had no effect on the lighting at all.
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    const surface = src.slice(
      src.indexOf("const surface = Fn("),
      src.indexOf("const out = surface"),
    );
    expect(surface.includes("waterNormal(info, clock, wxz)")).toBe(true);
    expect(surface.includes("fieldAt(")).toBe(true);
    expect(src.includes("normalFromInfo(info).add(swellTilt(")).toBe(true);
    // Wallace's peaking walk, and a real view ray rather than a flat-plane stand-in.
    expect(surface.includes("PEAK_ITERS")).toBe(true);
    expect(surface.includes("incomingRay")).toBe(true);
    expect(surface.includes('attribute("aBase", "float")')).toBe(true);
    // The noise is detail on the normal only; it must not be the height any more.
    expect(surface.includes("HEIGHT_AMP")).toBe(false);
  });

  it("refracts light through the same surface it shades", () => {
    // The second defect: shading used field + chop, but the caustics bent light with the field
    // alone, so the chop cast no caustics and the floor read as soft blobs, not ribbons.
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    const caustic = src.slice(
      src.indexOf("function landedAt("),
      src.indexOf("function poolFloorColor("),
    );
    expect(caustic.includes("waterNormal(info, clock, entry)")).toBe(true);
    expect(caustic.includes("normalFromInfo(")).toBe(false);
    // Exactly one place may build a water normal, or the two can drift apart again.
    expect((src.match(/normalFromInfo\(/g) ?? []).length).toBe(2);
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("poolFloor.setClock(reduced ? 0 : clock)")).toBe(true);
  });

  it("drapes the caustics on the pool floor, under the refracting film", () => {
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    expect(src.includes("makeWaterFloorMaterial")).toBe(true);
    expect(src.includes("poolFloorColor")).toBe(true);
    expect(src.includes("causticAt(")).toBe(true);
    // The film has to be see-through face-on or the floor and the cube are hidden behind it.
    expect(WATER_SURFACE_ALPHA).toBeLessThan(WATER_ALPHA);
    expect(WATER_SURFACE_ALPHA).toBeLessThan(0.5);
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("makeWaterFloorMaterial")).toBe(true);
    // Full-cell quads: an inset sheet leaves slits, and a substance cannot have slits.
    expect(view.includes("{ size: 1, segs: 10, renderOrder: 2, base: true }")).toBe(true);
  });

  it("never differentiates the caustic on the tessellated surface", () => {
    // The defect: the film's refracted colour called a screen-space Jacobian, whose dFdx/dFdy
    // jump at every triangle edge, so the water was hatched with diagonals following the
    // triangulation. The film samples tint only; the floor evaluates a world-xz Jacobian, and
    // every field tap pins LOD 0 so implicit derivatives cannot hatch the displaced mesh either.
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    const surface = src.slice(
      src.indexOf("const surface = Fn("),
      src.indexOf("const out = surface"),
    );
    expect(surface.includes("poolFloorTint(")).toBe(true);
    expect(surface.includes("poolFloorColor(")).toBe(false);
    expect(surface.includes("causticAt(")).toBe(false);
    const floor = src.slice(src.indexOf("const floor = Fn("), src.indexOf("const out = floor"));
    expect(floor.includes("poolFloorColor(")).toBe(true);
    expect(src.includes("function fieldAt(")).toBe(true);
    const fieldAt = src.slice(
      src.indexOf("function fieldAt("),
      src.indexOf("function normalFromInfo("),
    );
    expect(fieldAt.includes(".level(float(0))")).toBe(true);
  });

  it("bobs the cube on visual Y only, never the lattice or the camera", () => {
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("stepWaterRide")).toBe(true);
    expect(view.includes("reduced ? 0 : stepWaterRide")).toBe(true);
    const presenter = readFileSync(join(RENDER_SRC, "presenter.ts"), "utf8");
    expect(presenter.includes("cubeRig.position.y += worldView.waterBob")).toBe(true);
    // The camera target is built before the bob is applied, and never reads it.
    expect(presenter.includes("restY: frame.camera.restY")).toBe(true);
    const camera = readFileSync(join(RENDER_SRC, "camera.ts"), "utf8");
    expect(camera.includes("waterBob")).toBe(false);
  });

  it("splashes on every arrival in water, not only on a jump landing", () => {
    // Jump refuses from a wet cell (ADR 0013), so FLAG_LAND alone meant rolling — the only way a
    // player ever enters water — never disturbed the field.
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("rollingIn")).toBe(true);
    expect(view.includes("WATER_SPLASH_ROLL")).toBe(true);
    expect(view.includes("snapshot.move.phase === 1")).toBe(true);
    expect(view.includes("terrain.isWater(snapshot.move.destX, snapshot.move.destZ)")).toBe(true);
  });

  it("keeps the clock render-owned so reduced motion is a frozen, readable frame", () => {
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("water.setClock(reduced ? 0 : clock)")).toBe(true);
    expect(view.includes("grass.setClock(reduced ? 0 : clock)")).toBe(true);
    expect(view.includes("grass.setLean")).toBe(true);
    expect(view.includes("snapshot.move.destX")).toBe(true);
    expect(view.includes("MODE_ROLL")).toBe(true);
    expect(view.includes("coupleCube")).toBe(true);
    expect(view.includes("WATER_SURFACE")).toBe(true);
    expect(view.includes("setFieldOrigin")).toBe(true);
  });

  it("gates grass lean to the rolled cell so other meadows do not slide", () => {
    const src = readFileSync(join(RENDER_SRC, "water-mat.ts"), "utf8");
    expect(src.includes("onRolled")).toBe(true);
    expect(src.includes("vec2(lx, lz).mul(onRolled)")).toBe(true);
    expect(src.includes("leanCellX")).toBe(true);
  });
});
