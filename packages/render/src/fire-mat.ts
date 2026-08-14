import {
  Discard,
  Fn,
  If,
  attribute,
  float,
  length,
  mix,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { DoubleSide, InstancedBufferAttribute, MeshBasicNodeMaterial } from "three/webgpu";
import { fbm2 } from "./tsl-noise";
import type { AnimatedSurface } from "./water-mat";

/** TSL twin of `sim/fire-ramp.ts`. Keep the stops in lockstep. */
export const fireRampFn = /* @__PURE__ */ Fn(([T]: [ReturnType<typeof float>]) => {
  const t = T;
  let c = mix(vec3(0.54, 0.52, 0.5), vec3(0.55, 0.13, 0.02), smoothstep(0.04, 0.18, t));
  c = mix(c, vec3(0.9, 0.26, 0.04), smoothstep(0.18, 0.38, t));
  c = mix(c, vec3(1, 0.55, 0.08), smoothstep(0.38, 0.62, t));
  c = mix(c, vec3(1, 0.83, 0.35), smoothstep(0.62, 0.82, t));
  return mix(c, vec3(1, 0.97, 0.88), smoothstep(0.82, 0.97, t));
});

export function makeFireMaterial(): AnimatedSurface {
  // Same clock rule as water: TSL `time` lives in the shared render group and does not advance on
  // the WebGL2 fallback. Render owns the value; `onFrameUpdate` is the only write that dirties the UBO.
  let seconds = 0;
  const clock = uniform(0).onFrameUpdate(() => seconds);

  const fireDisc = Fn(() => {
    const T = attribute("aT", "float");
    const A = attribute("aA", "float");
    const seed = attribute("aSeed", "float");
    const q = uv().sub(0.5);
    const r = length(q).mul(2);
    const n = fbm2(
      q
        .mul(3.1)
        .add(vec2(seed.mul(13.7), seed.mul(7.1).sub(clock.mul(1.9)))) as unknown as ReturnType<
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
  const out = fireDisc();

  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.premultipliedAlpha = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.side = DoubleSide;
  material.fog = false;
  material.colorNode = out.xyz;
  material.opacityNode = out.w;

  return {
    material,
    setClock(next: number) {
      seconds = next;
    },
  };
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

/** Ice sheet. A hard leading edge so the slick cell reads as a shape, not a tint. */
export function makeIceMaterial(): MeshBasicNodeMaterial {
  const material = new MeshBasicNodeMaterial();
  material.transparent = true;
  material.premultipliedAlpha = true;
  material.depthWrite = false;
  material.depthTest = true;
  material.fog = false;
  const edge = smoothstep(0.72, 0.78, uv().x);
  const fill = vec3(0.102, 0.655, 0.769);
  const rim = vec3(0.22, 0.78, 0.88);
  const alpha = float(0.42).add(edge.mul(0.22));
  material.colorNode = mix(fill, rim, edge).mul(alpha);
  material.opacityNode = alpha;
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
