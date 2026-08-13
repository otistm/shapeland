import {
  Discard,
  Fn,
  If,
  attribute,
  float,
  hash,
  length,
  mix,
  smoothstep,
  time,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { DoubleSide, InstancedBufferAttribute, MeshBasicNodeMaterial } from "three/webgpu";

/** TSL twin of `sim/fire-ramp.ts`. Keep the stops in lockstep. */
export const fireRampFn = /* @__PURE__ */ Fn(([T]: [ReturnType<typeof float>]) => {
  const t = T;
  let c = mix(vec3(0.54, 0.52, 0.5), vec3(0.55, 0.13, 0.02), smoothstep(0.04, 0.18, t));
  c = mix(c, vec3(0.9, 0.26, 0.04), smoothstep(0.18, 0.38, t));
  c = mix(c, vec3(1, 0.55, 0.08), smoothstep(0.38, 0.62, t));
  c = mix(c, vec3(1, 0.83, 0.35), smoothstep(0.62, 0.82, t));
  return mix(c, vec3(1, 0.97, 0.88), smoothstep(0.82, 0.97, t));
});

function valueNoise(p: ReturnType<typeof vec2>): ReturnType<typeof float> {
  const i = p.floor();
  const f = p.fract();
  const u = f.mul(f).mul(float(3).sub(f.mul(2)));
  const a = hash(i.dot(vec2(1, 57)));
  const b = hash(i.add(vec2(1, 0)).dot(vec2(1, 57)));
  const c = hash(i.add(vec2(0, 1)).dot(vec2(1, 57)));
  const d = hash(i.add(vec2(1, 1)).dot(vec2(1, 57)));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

/** Two octaves of PCG value-noise. Integer hash, not sin/fract. */
const fbm2 = /* @__PURE__ */ Fn(([p]: [ReturnType<typeof vec2>]) => {
  const octave = p.mul(2.07) as unknown as ReturnType<typeof vec2>;
  return valueNoise(p).mul(0.65).add(valueNoise(octave).mul(0.35));
});

const fireDisc = /* @__PURE__ */ Fn(() => {
  const T = attribute("aT", "float");
  const A = attribute("aA", "float");
  const seed = attribute("aSeed", "float");
  const q = uv().sub(0.5);
  const r = length(q).mul(2);
  const n = fbm2(
    q.mul(3.1).add(vec2(seed.mul(13.7), seed.mul(7.1).sub(time.mul(1.9)))) as unknown as ReturnType<
      typeof vec2
    >,
  );
  const cool = float(1).sub(T);
  const d = r.sub(float(0.9).sub(cool.mul(0.4))).add(
    float(0.52)
      .sub(n)
      .mul(float(0.6).add(cool.mul(0.85))),
  );
  const a = float(1)
    .sub(smoothstep(-0.22, 0.1, d))
    .mul(A);
  If(a.lessThan(0.012), () => {
    Discard();
  });
  const col = fireRampFn(T as unknown as ReturnType<typeof float>);
  return vec4(col, a);
});

export function makeFireMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.premultipliedAlpha = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.side = DoubleSide;
  material.fog = false;
  const out = fireDisc();
  material.colorNode = out.xyz;
  material.opacityNode = out.w;
  return material;
}

export function makeVfxUnlit(color: number, opacity = 1): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  material.premultipliedAlpha = true;
  return material;
}

export function fireInstanceAttrs(count: number): {
  t: InstancedBufferAttribute;
  a: InstancedBufferAttribute;
  seed: InstancedBufferAttribute;
} {
  return {
    t: new InstancedBufferAttribute(new Float32Array(count), 1),
    a: new InstancedBufferAttribute(new Float32Array(count), 1),
    seed: new InstancedBufferAttribute(new Float32Array(count), 1),
  };
}
