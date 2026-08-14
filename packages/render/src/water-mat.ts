import { GRASS, KEY_LIGHT, SWAMP, WATER } from "@shapeland/sim";
import {
  Fn,
  attribute,
  cameraPosition,
  clamp,
  float,
  max,
  mix,
  normalize,
  oneMinus,
  positionLocal,
  pow,
  reflect,
  refract,
  saturate,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { InstancedBufferAttribute, MeshBasicNodeMaterial, type Texture } from "three/webgpu";
import { fbm2 } from "./tsl-noise";
import { WATER_FIELD_CELLS, WATER_FIELD_SPACING, WATER_SURFACE } from "./water-field";

const WATER_SCALE = 1.2;
const WATER_DRIFT = 0.26;
const SWAMP_SCALE = 0.9;
const GRASS_SCALE = 1.35;
/** Finite-difference step in cell units, for the noise swell only. */
const NORMAL_EPS = 0.04;
/**
 * How hard the noise chop tilts the field normal. Detail, never geometry — and deliberately
 * weaker than the field's own tilt, because at 0.32 the chop was several times stronger than the
 * cube's wake and hid the physics entirely behind what looked like scrolling shader noise.
 */
const SWELL_TILT = 0.14;
/** Wallace's `oldArea/newArea` gain. Unscaled Jacobian ratios blow out. */
const CAUSTIC_SCALE = 0.2;
/**
 * Wallace peaks the water by walking the sample coord along the normal
 * (`coord += info.ba * 0.005`, 5×). Same trick, in cell units.
 */
const PEAK_STEP = 0.03;
const PEAK_ITERS = 3;

/**
 * Sheet palette, linear RGB. Exported so readability is measured rather than eyeballed:
 * water must stay a mid-value teal, clear of ice cyan and clear of the white background.
 */
export const WATER_SHALLOW: readonly [number, number, number] = [0.29, 0.51, 0.56];
export const WATER_CREST_ADD: readonly [number, number, number] = [0.06, 0.09, 0.1];
/** Focused Jacobian band. Saturated brighter teal, still a mid-value on white. */
export const WATER_CAUSTIC_ADD: readonly [number, number, number] = [0.09, 0.14, 0.13];
export const WATER_SPEC_ADD: readonly [number, number, number] = [0.04, 0.06, 0.05];
/** Grazing bounce. Muted teal, never the white sky. */
export const WATER_FRESNEL: readonly [number, number, number] = [0.38, 0.58, 0.62];
export const WATER_ALPHA = 0.9;
/**
 * Face-on opacity of the surface film. Deliberately low: the caustic floor and the submerged
 * cube have to be visible *through* the water, which is the whole point of a substance.
 * Fresnel raises it to `WATER_ALPHA` at grazing angles.
 */
export const WATER_SURFACE_ALPHA = 0.34;
export const SWAMP_ALPHA = 0.92;
export const GRASS_ALPHA = 0.9;

/** Snell indices from Wallace's pool. Light travels air → water onto a shallow floor. */
export const IOR_AIR = 1;
export const IOR_WATER = 1.333;
export const WATER_ETA = IOR_AIR / IOR_WATER;
/** Floor-to-surface distance the refracted ray travels. */
export const WATER_DEPTH = WATER_SURFACE;

export interface AnimatedSurface {
  material: MeshBasicNodeMaterial;
  /**
   * Advance the sheet. Render owns the clock rather than TSL `time`, so reduced motion is a
   * matter of not advancing it, and the still frame stays readable.
   */
  setClock(seconds: number): void;
}

export interface WaterSurface extends AnimatedSurface {
  /** Heightfield window origin, vertex-stage only so the clock UBO stays fragment-only. */
  setFieldOrigin(x: number, z: number): void;
}

export interface LeaningSurface extends AnimatedSurface {
  /**
   * Fragment-domain offset on one cell. Roll lean teaches springy footing; it must not
   * slide every meadow tile in the world.
   */
  setLean(x: number, z: number, cellX?: number, cellZ?: number): void;
}

/**
 * Per-instance cell (x, z). Sheets take their noise domain from `aCell + uv()`, so the field is
 * continuous across neighbouring cells of one puddle. `positionWorld` is not an option here: it is
 * derived from `positionLocal`, so a sheet that reads it is self-referential.
 */
export function surfaceCellAttribute(count: number): InstancedBufferAttribute {
  return new InstancedBufferAttribute(new Float32Array(Math.max(1, count) * 2), 2);
}

/**
 * Per-instance resting surface Y. The water shader needs a world-space point to build the view
 * ray, and `positionWorld` is off limits while `positionNode` is assigned, so the base height
 * travels as an attribute instead.
 */
export function surfaceBaseAttribute(count: number): InstancedBufferAttribute {
  return new InstancedBufferAttribute(new Float32Array(Math.max(1, count)), 1);
}

function hexRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function cellDomain(scale: number): ReturnType<typeof vec2> {
  return attribute("aCell", "vec2").add(uv()).mul(scale) as unknown as ReturnType<typeof vec2>;
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

function lightDir() {
  const len = Math.hypot(KEY_LIGHT[0], KEY_LIGHT[1], KEY_LIGHT[2]);
  return vec3(KEY_LIGHT[0] / len, KEY_LIGHT[1] / len, KEY_LIGHT[2] / len);
}

const L = /* @__PURE__ */ lightDir();
const INCIDENT = /* @__PURE__ */ L.mul(-1);
const ETA = /* @__PURE__ */ float(WATER_ETA);
/** Wallace's `refractedLight`: the sun bent by a flat surface. The unperturbed reference. */
const FLAT_RAY = /* @__PURE__ */ refract(INCIDENT, vec3(0, 1, 0), ETA);

type Vec2Node = ReturnType<typeof vec2>;
type Vec4Node = ReturnType<typeof vec4>;

// TSL's generated types name a concrete node class per operation, so a `vec2`-shaped result from
// `.add()` is not assignable to a `vec2()` parameter. The shapes are identical at runtime.
const asVec2 = (n: unknown): Vec2Node => n as Vec2Node;
const asVec4 = (n: unknown): Vec4Node => n as Vec4Node;

/**
 * World xz of this sheet fragment. The quad is rotated `-π/2` about X, so local +y maps to
 * world −z — getting that sign wrong slides the whole field sideways under the cube.
 */
function sheetWorldXZ(): Vec2Node {
  const q = uv();
  return asVec2(attribute("aCell", "vec2").add(vec2(q.x.sub(0.5), float(0.5).sub(q.y))));
}

type OriginUniform = ReturnType<typeof uniform>;

function fieldUv(wxz: Vec2Node, ox: OriginUniform, oz: OriginUniform) {
  return wxz.sub(vec2(ox, oz)).div(WATER_FIELD_CELLS);
}

function fieldAt(fieldTex: Texture, ox: OriginUniform, oz: OriginUniform, wxz: Vec2Node): Vec4Node {
  // Explicit LOD: the field has no mips, and implicit derivatives on the tessellated film jump at
  // every triangle edge — the same diagonal hatching the caustic Jacobian used to paint.
  return asVec4(texture(fieldTex, fieldUv(wxz, ox, oz)).level(float(0)));
}

/** Wallace's `vec3(info.b, sqrt(1 - dot(info.ba, info.ba)), info.a)`. */
function normalFromInfo(info: Vec4Node) {
  const nxz = vec2(info.z, info.w);
  return vec3(nxz.x, sqrt(max(float(1e-4), oneMinus(nxz.dot(nxz)))), nxz.y);
}

/**
 * Fine chop on top of the field. Wallace seeds 20 random drops so his pool is never glassy; our
 * field window recenters on the cube and clears, so the ambient life comes from noise instead.
 */
function swellTilt(clock: OriginUniform, wxz: Vec2Node) {
  const d = clock.mul(WATER_DRIFT);
  const drift = vec2(d, d.mul(-0.7));
  const sample = (ox: number, oz: number) =>
    fbm2(wxz.add(vec2(ox, oz)).mul(WATER_SCALE).add(drift) as unknown as Vec2Node);
  const s0 = sample(0, 0);
  return vec3(
    s0.sub(sample(NORMAL_EPS, 0)).div(NORMAL_EPS).mul(SWELL_TILT),
    0,
    s0.sub(sample(0, NORMAL_EPS)).div(NORMAL_EPS).mul(SWELL_TILT),
  );
}

/**
 * The one water normal. Shading and refraction have to agree: if the surface you see is not the
 * surface that bends the light, the caustics are a lie and the chop contributes none of them.
 */
function waterNormal(info: Vec4Node, clock: OriginUniform, wxz: Vec2Node) {
  return normalize(normalFromInfo(info).add(swellTilt(clock, wxz)));
}

export function makeWaterMaterial(fieldTex: Texture): WaterSurface {
  // Render owns the value, but the uniform must go through three's per-frame update hook: a
  // plain `.value` write leaves the object UBO clean and the sheet never redraws. This is the
  // same mechanism TSL `time` uses, and `time` itself is unusable here because it lives in the
  // shared render group, which does not advance on the WebGL2 fallback.
  let seconds = 0;
  let fieldOriginX = 0;
  let fieldOriginZ = 0;
  const clock = uniform(0).onFrameUpdate(() => seconds);
  const originX = uniform(0).onFrameUpdate(() => fieldOriginX);
  const originZ = uniform(0).onFrameUpdate(() => fieldOriginZ);

  // Vertex displacement reads the heightfield and nothing else. A clock uniform consumed by both
  // stages lands in two UBOs and only one is re-uploaded on the WebGL2 fallback.
  // An explicit LOD is required: a vertex-stage sample has no screen-space derivatives to pick one.
  const disp = texture(fieldTex, fieldUv(sheetWorldXZ(), originX, originZ)).level(float(0)).x;

  const surface = Fn(() => {
    const wxz = sheetWorldXZ();
    // Peak the wave crests the way Wallace does, by walking the sample along the normal.
    let coord = wxz;
    let info = fieldAt(fieldTex, originX, originZ, coord);
    for (let i = 0; i < PEAK_ITERS; i++) {
      coord = asVec2(coord.add(vec2(info.z, info.w).mul(PEAK_STEP)));
      info = fieldAt(fieldTex, originX, originZ, coord);
    }

    // The field carries the cube's dimple and its wake; the chop is detail on top, and it is what
    // keeps a still puddle readable when the clock is frozen.
    const N = waterNormal(info, clock, wxz);

    // A real world-space point, so the view ray is real. `aBase` is the resting surface Y.
    const P = vec3(wxz.x, attribute("aBase", "float").add(info.x), wxz.y);
    const incomingRay = normalize(P.sub(cameraPosition));
    const facing = saturate(N.dot(incomingRay.mul(-1)));

    // Wallace's above-water pass: mix the refracted floor with the reflected sky by Fresnel.
    const refractedRay = refract(incomingRay, N, ETA);
    const travel = float(WATER_DEPTH)
      .add(info.x)
      .div(max(refractedRay.y.mul(-1), float(0.12)));
    const floorHit = asVec2(wxz.add(vec2(refractedRay.x, refractedRay.z).mul(travel)));
    // Depth tint only. Caustics are a smooth function of xz on the floor sheet; the film reads
    // them through alpha rather than evaluating them on this tessellated mesh.
    const refractedColor = poolFloorTint(fieldTex, originX, originZ, floorHit);

    const reflectedRay = reflect(incomingRay, N);
    const spec = smoothstep(0.86, 0.96, pow(saturate(L.dot(reflectedRay)), 48));
    const reflectedColor = vec3(...WATER_FRESNEL).add(vec3(...WATER_SPEC_ADD).mul(spec));

    const fresnel = pow(oneMinus(facing), 3);
    const color = mix(refractedColor, reflectedColor, fresnel);
    // Thin face-on so the floor and the submerged cube read through; opaque at grazing angles.
    const alpha = mix(float(WATER_SURFACE_ALPHA), float(WATER_ALPHA), fresnel);
    return vec4(color.mul(alpha), alpha);
  });
  const out = surface();

  const material = makeUnlitSheet();
  material.positionNode = positionLocal.add(vec3(0, 0, disp));
  material.colorNode = out.xyz;
  material.opacityNode = out.w;

  return {
    material,
    setClock(next: number) {
      seconds = next;
    },
    setFieldOrigin(x, z) {
      fieldOriginX = x;
      fieldOriginZ = z;
    },
  };
}

/**
 * Where a sun ray that entered at `entry` lands on the floor, after the real surface normal
 * bends it. Shared by the three finite-difference samples that build the caustic Jacobian.
 */
function landedAt(
  fieldTex: Texture,
  ox: OriginUniform,
  oz: OriginUniform,
  clock: OriginUniform,
  entry: Vec2Node,
): Vec2Node {
  const info = fieldAt(fieldTex, ox, oz, entry);
  const bent = refract(INCIDENT, waterNormal(info, clock, entry), ETA);
  const travel = float(WATER_DEPTH)
    .add(info.x)
    .div(max(bent.y.mul(-1), float(0.08)));
  return asVec2(entry.add(vec2(bent.x, bent.z).mul(travel)));
}

/**
 * Wallace's caustic, as a function of floor xz — the same thing his surface shader gets by
 * sampling a finished caustic texture. For a floor point we walk back along the flat refracted
 * sun ray, bend by the real normal, and compare the area a one-texel patch covers before and
 * after. The Jacobian lives in world xz, never in screen space: `dFdx`/`dFdy` follow the
 * camera's pixel axes (diagonal under the quarter-turn yaw) and jump at every triangle edge,
 * which is the hatching. https://medium.com/@evanwallace/rendering-realtime-caustics-in-webgl-2a99a29a0b2c
 */
function causticAt(
  fieldTex: Texture,
  ox: OriginUniform,
  oz: OriginUniform,
  clock: OriginUniform,
  floorXZ: Vec2Node,
) {
  const toSurface = float(WATER_DEPTH).div(FLAT_RAY.y.mul(-1));
  const entry = asVec2(floorXZ.sub(vec2(FLAT_RAY.x, FLAT_RAY.z).mul(toSurface)));
  const eps = float(WATER_FIELD_SPACING);
  const p0 = landedAt(fieldTex, ox, oz, clock, entry);
  const px = landedAt(fieldTex, ox, oz, clock, asVec2(entry.add(vec2(eps, 0))));
  const pz = landedAt(fieldTex, ox, oz, clock, asVec2(entry.add(vec2(0, eps))));
  const dx = asVec2(px.sub(p0));
  const dz = asVec2(pz.sub(p0));
  // Parallelogram area in world xz. If the patch shrinks, it gets brighter.
  const newArea = dx.x.mul(dz.y).sub(dx.y.mul(dz.x)).abs();
  const oldArea = eps.mul(eps);
  const intensity = clamp(oldArea.div(max(newArea, float(1e-5))).mul(CAUSTIC_SCALE), 0, 2.4);
  // Bands, not a smooth HDR glow: additive white is invisible on this world.
  return smoothstep(0.16, 0.3, intensity).add(smoothstep(0.42, 0.8, intensity).mul(0.7));
}

/** The pool bottom without caustics: depth tint and wake crests. */
function poolFloorTint(fieldTex: Texture, ox: OriginUniform, oz: OriginUniform, floorXZ: Vec2Node) {
  const [dr, dg, db] = hexRgb(WATER);
  const info = fieldAt(fieldTex, ox, oz, floorXZ);
  // The cube's dimple reads as a deeper well; its wake crests read shallower.
  const shallowness = saturate(info.x.mul(2.4).add(0.5));
  const crest = smoothstep(0.06, 0.2, info.x);
  return mix(vec3(dr, dg, db), vec3(...WATER_SHALLOW), shallowness).add(
    vec3(...WATER_CREST_ADD).mul(crest),
  );
}

/** The lit pool bottom: depth-tinted teal, wake crests, and the focused caustic ribbons. */
function poolFloorColor(
  fieldTex: Texture,
  ox: OriginUniform,
  oz: OriginUniform,
  clock: OriginUniform,
  floorXZ: Vec2Node,
) {
  return poolFloorTint(fieldTex, ox, oz, floorXZ).add(
    vec3(...WATER_CAUSTIC_ADD).mul(causticAt(fieldTex, ox, oz, clock, floorXZ)),
  );
}

/**
 * The pool bottom, stamped on the terrain top under every wet cell. This is where the demo's
 * caustics actually live — draped on the floor, seen through the surface film above.
 */
export function makeWaterFloorMaterial(fieldTex: Texture): WaterSurface {
  let seconds = 0;
  let fieldOriginX = 0;
  let fieldOriginZ = 0;
  // Fragment-only material, so a clock here is safe: the dual-UBO freeze needs one uniform read
  // by both stages of the *same* material.
  const clock = uniform(0).onFrameUpdate(() => seconds);
  const originX = uniform(0).onFrameUpdate(() => fieldOriginX);
  const originZ = uniform(0).onFrameUpdate(() => fieldOriginZ);

  const floor = Fn(() => {
    const color = poolFloorColor(fieldTex, originX, originZ, clock, sheetWorldXZ());
    const alpha = float(WATER_ALPHA);
    return vec4(color.mul(alpha), alpha);
  });
  const out = floor();

  const material = makeUnlitSheet();
  material.colorNode = out.xyz;
  material.opacityNode = out.w;

  return {
    material,
    setClock(next: number) {
      seconds = next;
    },
    setFieldOrigin(x, z) {
      fieldOriginX = x;
      fieldOriginZ = z;
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
  let leanCellX = 0;
  let leanCellZ = 0;
  const clock = uniform(0).onFrameUpdate(() => seconds);
  const lx = uniform(0).onFrameUpdate(() => leanX);
  const lz = uniform(0).onFrameUpdate(() => leanZ);
  const lcx = uniform(0).onFrameUpdate(() => leanCellX);
  const lcz = uniform(0).onFrameUpdate(() => leanCellZ);
  const [r, g, b] = hexRgb(GRASS);
  const cell = attribute("aCell", "vec2");
  const delta = cell.sub(vec2(lcx, lcz)).abs();
  const onRolled = oneMinus(saturate(delta.x.add(delta.y)));
  const n = fbm2(
    cellDomain(GRASS_SCALE).add(
      vec2(clock.mul(0.08), clock.mul(-0.06)).add(vec2(lx, lz).mul(onRolled)),
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
    setLean(x, z, cellX = 0, cellZ = 0) {
      leanX = x;
      leanZ = z;
      leanCellX = cellX;
      leanCellZ = cellZ;
    },
  };
}
