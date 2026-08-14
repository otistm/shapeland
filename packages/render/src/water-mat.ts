import { GRASS, SWAMP, WATER } from "@shapeland/sim";
import { attribute, float, mix, smoothstep, uniform, uv, vec2, vec3 } from "three/tsl";
import { InstancedBufferAttribute, MeshBasicNodeMaterial } from "three/webgpu";
import { fbm2 } from "./tsl-noise";

const WATER_SCALE = 1.2;
const WATER_DRIFT = 0.26;
const SWAMP_SCALE = 0.9;
const GRASS_SCALE = 1.35;

/**
 * Sheet palette, linear RGB. Exported so readability is measured rather than eyeballed:
 * water must stay a mid-value teal, clear of ice cyan and clear of the white background.
 */
export const WATER_SHALLOW: readonly [number, number, number] = [0.29, 0.51, 0.56];
export const WATER_CREST_ADD: readonly [number, number, number] = [0.11, 0.16, 0.17];
export const WATER_ALPHA = 0.9;
export const SWAMP_ALPHA = 0.92;
export const GRASS_ALPHA = 0.9;

export interface AnimatedSurface {
  material: MeshBasicNodeMaterial;
  /**
   * Advance the sheet. Render owns the clock rather than TSL `time`, so reduced motion is a
   * matter of not advancing it, and the still frame stays readable.
   */
  setClock(seconds: number): void;
}

export interface LeaningSurface extends AnimatedSurface {
  /** Fragment-domain offset. Roll lean teaches springy footing; never displaces height. */
  setLean(x: number, z: number): void;
}

/**
 * Per-instance cell (x, z). Sheets take their noise domain from `aCell + uv()`, so the field is
 * continuous across neighbouring cells of one puddle. `positionWorld` is not an option here: it is
 * derived from `positionLocal`, so a sheet that reads it is self-referential.
 */
export function surfaceCellAttribute(count: number): InstancedBufferAttribute {
  return new InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function cellDomain(scale: number): ReturnType<typeof vec2> {
  return attribute("aCell", "vec2").add(uv()).mul(scale) as unknown as ReturnType<typeof vec2>;
}

function swell(
  clock: ReturnType<typeof uniform>,
  scale: number,
  drift: number,
): ReturnType<typeof float> {
  const d = clock.mul(drift);
  const p = cellDomain(scale).add(vec2(d, d.mul(-0.7)));
  return fbm2(p as unknown as ReturnType<typeof vec2>);
}

function makeUnlitSheet(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.premultipliedAlpha = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.fog = false;
  return material;
}

export function makeWaterMaterial(): AnimatedSurface {
  // Render owns the value, but the uniform must go through three's per-frame update hook: a
  // plain `.value` write leaves the object UBO clean and the sheet never redraws. This is the
  // same mechanism TSL `time` uses, and `time` itself is unusable here because it lives in the
  // shared render group, which does not advance on the WebGL2 fallback.
  let seconds = 0;
  const clock = uniform(0).onFrameUpdate(() => seconds);
  const [dr, dg, db] = hexRgb(WATER);

  const n = swell(clock, WATER_SCALE, WATER_DRIFT);
  const deep = vec3(dr, dg, db);
  const shallow = vec3(...WATER_SHALLOW);
  // A band, not a smooth gradient: the ripple has to read as a shape while it moves.
  const crest = smoothstep(0.54, 0.74, n);
  const alpha = float(WATER_ALPHA).add(crest.mul(0.06));
  const color = mix(deep, shallow, n).add(vec3(...WATER_CREST_ADD).mul(crest));

  // Fragment stage only, deliberately. A clock uniform consumed by both stages lands in a vertex
  // UBO and a fragment UBO, and only one of them is re-uploaded on the WebGL2 fallback, which
  // froze the sheet. Staying out of the vertex stage also leaves instancing completely stock.
  const material = makeUnlitSheet();
  material.colorNode = color.mul(alpha);
  material.opacityNode = alpha;

  return {
    material,
    setClock(next: number) {
      seconds = next;
    },
  };
}

export function makeSwampMaterial(): MeshBasicNodeMaterial {
  const [r, g, b] = hexRgb(SWAMP);
  const n = fbm2(cellDomain(SWAMP_SCALE));
  const mud = vec3(r, g, b);
  const scum = vec3(0.35, 0.4, 0.28);
  const alpha = float(SWAMP_ALPHA);
  const material = makeUnlitSheet();
  material.colorNode = mix(mud, scum, smoothstep(0.4, 0.8, n)).mul(alpha);
  material.opacityNode = alpha;
  return material;
}

export function makeGrassMaterial(): LeaningSurface {
  let seconds = 0;
  let leanX = 0;
  let leanZ = 0;
  const clock = uniform(0).onFrameUpdate(() => seconds);
  const lx = uniform(0).onFrameUpdate(() => leanX);
  const lz = uniform(0).onFrameUpdate(() => leanZ);
  const [r, g, b] = hexRgb(GRASS);
  const n = fbm2(
    cellDomain(GRASS_SCALE).add(
      vec2(clock.mul(0.08).add(lx), clock.mul(-0.06).add(lz)),
    ) as unknown as ReturnType<typeof vec2>,
  );
  const turf = vec3(r, g, b);
  const blade = vec3(0.45, 0.52, 0.28);
  const alpha = float(GRASS_ALPHA);
  const material = makeUnlitSheet();
  material.colorNode = mix(turf, blade, smoothstep(0.35, 0.78, n)).mul(alpha);
  material.opacityNode = alpha;
  return {
    material,
    setClock(next: number) {
      seconds = next;
    },
    setLean(x: number, z: number) {
      leanX = x;
      leanZ = z;
    },
  };
}
