# Shapeland Research Brief: Custom Complex Shaders + WebGPU

---

## PART A — CUSTOM COMPLEX SHADERS

### A1. Three Shading Language (TSL)

- **What it is**: a JS/TS node-graph DSL shipped inside three.js (`three/tsl`), used with `three/webgpu` node materials. Node graphs are compiled by `NodeBuilder` to **WGSL** (WebGPU backend) or **GLSL** (WebGL2 backend) from the same source. This dual-compile is the single strongest reason to author VFX in TSL rather than raw WGSL for Shapeland's WebGPU-first/WebGL2-fallback target.
- **Status**: officially documented at `threejs.org/docs/TSL.html` (mirror of the repo wiki), but the *renderer* it belongs to is still labeled experimental by three.js maintainers. Expect API churn between minor releases; pin your three version.
- **Core constructs**:
  - `uniform(value, type?)` — dynamic value, mutate via `.value`; also `uniform.onFrameUpdate()/onObjectUpdate()`.
  - `Fn(fn, layout?)` — reusable shader function. Unlike inline node chains, `Fn` gives a *stack* so `.assign()`, `If()/.ElseIf()/.Else()`, `Switch`, and `Loop()` work. Returns a factory — **you must invoke it** (`material.colorNode = myFn()`).
  - `.toVar(name?)` / `Var()` — materializes a real shader local; required for anything reassigned.
  - `varying(node, name?)` — compute in vertex stage, interpolate to fragment. `vertexStage(node)` forces vertex-stage evaluation. `varyingProperty(type)` declares without init.
  - Attributes/builtins: `positionLocal/positionWorld/positionView`, `normalLocal/normalWorld`, `uv()`, `cameraPosition`, `modelViewMatrix`, `screenUV`, `time`, `deltaTime`, `instanceIndex`.
  - `struct({min:'vec3',max:'vec3'})`, `outputStruct(...)` for MRT.
  - Second `Fn` arg is the `NodeBuilder`, exposing `{ material, geometry, object, camera, renderer }` — so a single TSL function can branch on `material.userData` at *compile* time (no runtime cost).
- **Material slots**: `colorNode`, `emissiveNode`, `positionNode`, `normalNode`, `roughnessNode`, `metalnessNode`, `opacityNode`, `aoNode`, `outputNode`, plus escape hatches `fragmentNode` / `vertexNode` (replace the whole stage) and `geometryNode`.
- **Porting GLSL → TSL**: an addon transpiler exists, but its output always needs hand-fixups — replace `uniform('float')` stubs with `uniform(value)`, drop duplicated varying declarations, drop `{ return: 'void' }` and `overloadingFn`, map `position→positionLocal`, add `.toVar()` on reassigned vars, convert `gl_Position.assign(...)`/`gl_FragColor.assign(...)` into `return`, and remember the trailing `()`.
- **Notable convenience**: TSL papers over backend gaps — e.g. `textureSample()` in a vertex shader isn't legal WGSL, and TSL transpiles it to something that works.
- **Reusable library precedent**: `tsl-textures` (npm) ships `simplexNoise` etc. as importable TSL nodes; a good structural model for a `shapeland/tsl-vfx` package.

```js
import { Fn, uniform, texture, dot, normalWorld, vec2, vec3, clamp } from 'three/tsl';

// 3-texel nearest ramp LUT lookup. rampTex: 3x1, min/magFilter = NearestFilter, colorSpace = NoColorSpace
export const toonBand = /*@__PURE__*/ Fn(([lightDir, rampTex, wrap]) => {
  const ndl = dot(normalWorld, lightDir).mul(0.5).add(0.5).toVar();      // half-Lambert
  const t = clamp(ndl.add(wrap), 0.0, 0.9999);                            // 0.9999 avoids texel-3 clamp pop
  return texture(rampTex, vec2(t, 0.5)).rgb;
});
```

### A2. WGSL essentials coming from GLSL

- **Types on the right**: `var x: f32 = 1.0;`. `f32/i32/u32/bool`; `vec4<f32>` (alias `vec4f`), `mat4x4<f32>`. **No `double`/`dvec`.**
- **`var` = mutable, `let` = immutable binding, `const` = compile-time constant.** (`let` in WGSL ≠ `let` in JS.)
- **Zero implicit conversions.** `f32(myInt) + myFloat`. Integer literals need `u`/`i` suffixes in ambiguous contexts.
- **Entry points** are explicit: `@vertex`, `@fragment`, `@compute @workgroup_size(x,y,z)`. Attributes are *function parameters* with mandatory `@location(n)` (no auto-assignment). Varyings are a returned struct with `@location(n)` fields. `gl_Position` → `@builtin(position)`; frag output → `@location(0)`.
- **Bindings**: `@group(n) @binding(m)` on every resource; textures and samplers are separate bindings (`texture_2d<f32>`, `sampler`), sampled via `textureSample(tex, samp, uv)`. Shaders only require bindings their entry point *transitively* accesses.
- **Common porting mistakes**:
  - `@builtin(position)` in fragment is **top-left origin**; WebGL's `gl_FragCoord` is bottom-left. Flips are the #1 source of "my post FX is upside down."
  - NDC Z range differs from OpenGL (0..1 vs −1..1) — matters for hand-rolled depth math.
  - No ternary: use `select(falseVal, trueVal, cond)`. Braces mandatory on `if`.
  - `switch` requires braces per case and explicit fallthrough semantics; scrutinee typically `u32`.
  - `textureSample` is **not allowed in non-uniform control flow** — hoist samples above branches.
  - `mat3x2<f32>` = 3 columns × 2 rows; WGSL matrices are column-major like GLSL, but the naming order trips people.

### A3. Toon/cel shading, tuned for a WHITE world

- **Quantized ramp**: sample a tiny 1D LUT (3 texels for Shapeland) with `NearestFilter` on both `minFilter` and `magFilter`, and `colorSpace = NoColorSpace` (it's data, not color). This is exactly what `MeshToonMaterial.gradientMap` requires; the same rule applies to a hand-rolled TSL ramp. Any linear filtering silently reintroduces gradients.
- **Band edges as f(N·L)**: define edges in ramp *UV* space, not in shader constants, so artists can retune by repainting 3 texels. Use half-Lambert (`N·L*0.5+0.5`) so the terminator sits mid-ramp and back-facing regions still receive a band rather than collapsing to edge 0.
- **Faceted geometry**: smooth (averaged) vertex normals make N·L vary continuously across a face, so the band edge cuts *through* facets and wobbles under camera motion. Fix: `geometry = geometry.toNonIndexed(); geometry.computeVertexNormals();` — non-indexed geometry shares no vertices, so computed normals become per-face constants and each facet lands squarely in one band. `material.flatShading = true` achieves the visual result via derivatives but costs you the ability to author per-vertex normal art; prefer `toNonIndexed` as a build-time bake.
- **Rim light**: `pow(1 - saturate(dot(N, V)), k)`, then **quantize it into the same ramp** — a smooth rim on a cel object reads as a bug. On white, rim must be a *saturated hue* (cyan/magenta), never white-on-white.
- **Outlines** — ranked for Shapeland:
  1. *Inverted hull* (`p + n * t`, front-face culled, solid color, optionally stencil-masked): cheapest, silhouette-only, needs smooth normals for the hull — which conflicts with the `toNonIndexed` bake, so keep a **separate smooth-normal attribute** (`aOutlineNormal`) on the non-indexed geometry.
  2. *Depth/normal edge detection* (Roberts cross on 4 diagonal samples, separate thresholds for depth, normals, luminance, combined with `max`): gets interior lines, needs a depth+normal prepass. Fade edges with distance to kill noise.
  3. *Jump flood* for wide outlines: `O(log n)` passes with halving grid spacing (16→8→4→2→1 for a 16px outline). Per bgolus: brute force wins at exactly 1px, JFA wins for anything wider.
- **Readability on white**: your background is the brightest value in frame, so **all contrast must come from darkening and hue**. Outlines and shadow bands are the load-bearing elements; a mid-value saturated shadow band on a white floor is what separates objects. Reserve near-white for the background only — clamp the lightest ramp texel to ~0.92 so lit surfaces never merge into the void.

### A4. Procedural noise

- **Hashes**: never ship `sin/fract` hashes — `sin(largeNumber)` is not consistent across NVIDIA OpenGL vs D3D vs Vulkan vs AMD vs mobile, so noise *shifts per GPU vendor*. Use an integer hash. Jarzynski & Olano's survey puts **PCG** on the Pareto frontier (Wang hash is dominated); `lowbias32` has lower bias at similar cost.

```wgsl
fn pcg(v: u32) -> u32 {
  let state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
fn hash3(p: vec3<i32>) -> f32 {
  let h = pcg(u32(p.x) * 73856093u ^ u32(p.y) * 19349663u ^ u32(p.z) * 83492791u);
  return f32(h) * (1.0 / 4294967295.0);
}
```

- **Family tradeoffs**: value = cheapest, "pillow"/blocky artifacts (gradient info lost at cell edges); Perlin/simplex = gradient noise, no value-banding; simplex uses n+1 corners vs Perlin's 2ⁿ (3D: 4 vs 8 lookups), so it wins as dimensionality rises; Worley/cellular = distance-to-feature-points, expensive (3×3 or 3×3×3 cell scan) but the only one that gives cracks/scales/scorch cells.
- **fbm**: sum octaves with lacunarity ≈2, gain ≈0.5, and **rotate the domain between octaves** (a fixed 2×2 rotation matrix) to kill axis-aligned artifacts. Ridged variant: `1 - abs(n)`, squared.
- **Domain warping** (iq): `f(p + h(p))`. Double warp = `fbm(p + fbm2(p + fbm2(p)*k)*k)`; at 5 octaves each that's ~15 noise evals per fragment. Budget 3–4 octaves per warp level on mid-tier hardware.
- **Cost discipline for Shapeland**: bake static noise (scorch decal masks, floor detail) into textures at init via a compute pass; reserve live fbm for fire/plume where animation in the 3rd/4th dimension is the point.

### A5. Fire / plume

- **Physics**: Planck's law gives spectral radiance `L(λ,T) = (2hc²/λ⁵) / (exp(hc/λkT) − 1)`. Correct pipeline: evaluate over 380–780nm (5nm steps, 81 samples), integrate against CIE XYZ color-matching functions, chromatic-adapt (CAT02) against the fire's max temperature, then XYZ→sRGB. Flames aren't true blackbodies, but treating **soot** as a blackbody radiator is the standard, defensible approximation.
- **Practical form**: bake a **1D LUT** (EXR/float16, e.g. 256 texels, exponential T mapping over ~600–6000K for fire) at build time from a Python/Node script. This is strictly better than the Tanner Helland / Neil Bartlett polynomial fits for a stylized game because you control the mapping curve.
- **Monotonicity — important correction**: Planck's law is monotonic in `T` at *every* fixed wavelength, so **absolute** radiance rises in all channels as temperature rises. But the well-known Helland/Bartlett approximations are **normalized to white at 6500K**, so in those fits red *decreases* above ~6600K and is clamped below it. If you author a blackbody ramp by eye against those tables you'll get a non-physical, hue-skewed hot core. Author in **absolute radiance**, then expose brightness separately.
- **Erosion by noise**: sample fbm in the particle's local UV+time, then `alpha = smoothstep(threshold, threshold + softness, mask - fbm)`, with `threshold` driven by particle age. This dissolves the circular billboard silhouette — the single highest-impact fire technique.
- **Soft particles**: fade alpha by depth proximity to scene geometry: `fade = saturate(invFade * (sceneZ - partZ))`, both linearized to eye space, then multiply into alpha. Prevents hard intersection lines where flame meets the white floor.
- **Blending on white — the critical constraint**: additive blending has "nowhere to go" on a white background; the effect vanishes. Use **premultiplied alpha** (`One, OneMinusSrcAlpha`): `out = srcRGB + dstRGB*(1 - srcA)`. This lets a single material be *additive where alpha≈0* and *alpha-blended where alpha≈1*, so the hot core can still add energy while the smoke/soot skirt darkens the white behind it. Multiply RGB by alpha in-shader. Note the gotcha: fading to invisible requires **both** RGB and A → 0.

### A6. Lightning

- **Channel generation** (CPU, per strike): recursive midpoint displacement. Start with segment `S(a,b)`; displace midpoint perpendicular to `S` by a random magnitude; recurse on both halves with magnitude **halved** each level; stop at depth 4–15. Result is spectrally Perlin-like.
- **Branching**: at each recursion, spawn a child with exponentially decaying probability; children get shorter length and **thinner width**. Keep width uniform *within* a branch — varying width along a single channel reads as unrealistic, per the RPI study. Bias children toward the target direction (blend perpendicular displacement ~±0.6 with forward momentum 0.3–0.8) so you never get backward branching.
- **Geometry**: camera-facing ribbon strips (or two crossed quads per segment for cheap volume). Corner gaps/overlaps at branch joints are the classic artifact — the nVidia-paper fix is a smoothing post pass; the cheaper production fix is per-joint-angle texture variants.
- **Two-layer core + corona**: thin, near-white-but-tinted core (e.g. `vec3(0.55,0.60,1.0)`) plus a wider, lower-alpha corona ribbon at a **saturated** hue. Branches get `core * I` (I<1) so they sit visually behind the main channel.
- **Temporal chatter**: regenerate the displacement seed at 12–20 Hz (not per-frame at 60 — that reads as noise), and flicker intensity on a separate faster envelope. Seeded generation gives determinism for replay/CI.
- **Reading on white**: additive glow is useless here. The discharge must be a **dark-cored, saturated-corona** shape — invert the usual dark-sky logic: draw the channel as a deep violet/indigo ribbon with a bright *thin* highlight, and let a short-lived screen-space desaturation or a colored dynamic light on the floor carry the "flash."

### A7. GPU compute particles

- **TSL path** (recommended, since it also compiles to WebGL2): `instancedArray(count, 'vec3')` for storage arrays, `storage(attribute, type, count)` for BufferAttribute-backed storage, `instanceIndex` / `globalId` / `localId` / `workgroupId` for indexing, `.compute(count, workgroupSize = [64])` to build the dispatch, `renderer.compute(node)` to run it. Atomics (`atomicAdd/Min/Max/Store/Load`), `workgroupBarrier()`, `storageBarrier()`, and `subgroupSize` are all exposed.

```js
import { Fn, instancedArray, instanceIndex, deltaTime } from 'three/tsl';
const pos = instancedArray(COUNT, 'vec3'), vel = instancedArray(COUNT, 'vec3');
const step = Fn(() => {
  const p = pos.element(instanceIndex), v = vel.element(instanceIndex);
  v.addAssign(vec3(0, 9.8, 0).mul(deltaTime));   // buoyant plume
  p.addAssign(v.mul(deltaTime));
})().compute(COUNT);
renderer.compute(step);
```

- **Ping-pong**: two storage buffers, swap bind groups per frame. Needed whenever a particle reads *neighbors*; unnecessary for purely per-particle integration (read-modify-write in place is safe since each invocation owns one index).
- **Indirect draw**: keep a live count in a `u32` atomic, `resolve` it into a buffer with `INDIRECT` usage, and `drawIndexedIndirect` so the CPU never learns the particle count. This is what makes spawn/kill free.
- **Sorting**: only sort if you're alpha-blending (you are — see A5). Bitonic or a workgroup-local radix pass; for plumes you can often skip a full sort by sorting *emitters* on CPU and relying on per-emitter depth ordering.
- **CPU oracle**: the sim is float; bit-exact cross-vendor match is unattainable without fixed-point integer arithmetic (Q16.16 + int64 accumulators — real, but overkill here). So test **statistically**: run the same seeded PCG stream on CPU, then assert on distribution invariants (mean/variance of position and velocity, particle count, bounding box, energy decay) within tolerance, plus exact-match the *integer* state (spawn indices, lifetimes-in-ticks, RNG counter). Keep the CPU version as the spec for gameplay-relevant quantities only.

### A8. Post-processing on a high-key scene

- **Tone mapping**: **Khronos PBR Neutral** is the right default for Shapeland — it was explicitly designed to preserve saturation and avoid hue skew, and ACES/AgX are known to lose saturation. Since your entire brightness budget is *saturation*, ACES will actively fight the art direction. AgX (base) is deliberately low-contrast, a grading starting point, not a finish; `AgXPunchy` exists if you want a more ACES-like look. With the WebGPU postprocessing stack, disable the renderer's automatic output transform and apply tone mapping as a final node.
- **Bloom is a trap**: bloom adds energy around bright pixels. Your background is already at maximum, so bloom (a) does nothing where it would help and (b) veils your outlines and band edges into mush, destroying exactly the two features carrying readability. If you need "heat," use a **local** effect instead: chromatic warp / refraction offset around the plume, or a colored light pool on the floor.
- **Effects that do work on white**: depth-based color darkening (aerial perspective *inverted* — distant objects lose saturation toward white, near objects gain it), a subtle vignette in a saturated hue, screen-space AO tinted (never gray), and outline compositing.
- **Accessibility**: gate all camera shake, chatter, and flicker behind `matchMedia('(prefers-reduced-motion: reduce)')` — lightning temporal chatter and fire flicker are the exact stimulus class this setting exists for; clamp flicker amplitude and rate rather than disabling the effect. For colorblind safety, never encode gameplay state in hue alone — your 3-texel ramp gives you a free **value** channel; pair every hue cue with a distinct band count or outline weight. Verify the shadow-band value delta against white for ≥3:1 luminance contrast.

---

## PART B — WEBGPU TECHNOLOGIES

### B1. Support status and fallbacks

- **Shipping by default** (verified against the gpuweb Implementation Status wiki + web.dev, Aug 2026):
  - **Chrome/Edge**: Windows (D3D12), macOS, ChromeOS since 113 (2023); Android 121+ on Android 12+ with Qualcomm/ARM GPUs; **Linux rolling out driver-by-driver** (Intel Gen12+ from ~144).
  - **Firefox**: Windows since 141; macOS 26+ (Apple Silicon) since 145, all macOS versions since 147. **Linux and Android still Nightly/flagged**, targeted for 2026.
  - **Safari**: 26 on macOS Tahoe 26, iOS 26, iPadOS 26, visionOS 26. WebXR+WebGPU from 26.2.
- **Therefore you still need WebGL2**: Linux desktop, older iOS/macOS, Firefox Android, and any blocklisted driver. Do not treat the fallback as optional.
- **Probe at startup** — the three.js-specific gotcha is that `new WebGPURenderer().backend` reports `WebGPUBackend` *even when WebGPU is unavailable*, because selection is async. You must await:

```js
import * as THREE from 'three/webgpu';
import WebGPU from 'three/addons/capabilities/WebGPU.js';

const renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: !WebGPU.isAvailable() });
await renderer.init();                       // required before touching .backend
const isWebGPU = renderer.backend.isWebGPUBackend === true;

// raw capability probe for feature gating
const adapter = await navigator.gpu?.requestAdapter({ powerPreference: 'high-performance' });
const want = ['timestamp-query', 'float32-filterable', 'subgroups'];
const have = want.filter(f => adapter.features.has(f));
const device = await adapter.requestDevice({
  requiredFeatures: have,
  requiredLimits: { maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize },
});
device.lost.then(info => respawnRenderer(info));   // MUST handle; see B6
```

- Always request only the limits you need — asking for the adapter max is fine, but blindly raising limits can push you onto a slower path or fail on tier-1 mobile.

### B2. Core API model and cost model

- **Init-time only (expensive)**: `createRenderPipeline` / `createComputePipeline` (shader compile + state validation; use the `Async` variants and warm every pipeline before first frame), `createShaderModule`, explicit `GPUBindGroupLayout` + `GPUPipelineLayout`, buffer/texture allocation. Creating a pipeline mid-render loop causes visible hitches.
- **Per-frame, cheap**: `createCommandEncoder`, `beginRenderPass`, `queue.writeBuffer`, `queue.submit`. Encoders are single-use and disposable.
- **Per-draw, treat as expensive**: `setPipeline()` — minimize switches; and `setBindGroup()` — any state change in a pass costs, and setting the same state twice is not optimized away.
- **Bind group discipline**: `@group(0)` = least frequently changing (camera/frame), ascending groups = ascending update frequency (material → per-object). The API is order-agnostic but native backends are not. Avoid `layout:'auto'` except for one-off compute/post passes — share explicit layouts so pipelines are interchangeable.
- **Buffer usage flags** are immutable at creation: `UNIFORM | COPY_DST` for constants; `STORAGE | COPY_DST` for large/read-write/runtime-sized; add `INDIRECT` for GPU-driven draws, `QUERY_RESOLVE` for timestamps, and keep a separate `MAP_READ | COPY_DST` staging buffer for readback (never map a buffer you also render from).

### B3. Compute

- **Workgroup size: start at 64.** AMD/Apple execute 64 lanes per unit, NVIDIA 32 — 64 is the least common multiple, so it keeps lanes busy on all three. A size of 1 wastes 31–63 lanes.
- **Default limits**: `maxComputeInvocationsPerWorkgroup` = 256 (so `x*y*z ≤ 256`), `maxComputeWorkgroupSizeX/Y` = 256, `Z` = 64. Read `device.limits` and derive; don't hardcode.
- **Shared memory**: `var<workgroup> tile: array<f32, 64>;` — guaranteed **≥16KB per workgroup**; staying under 16KB is the portability rule. Access is ~10–20 cycles vs hundreds for global.
- **Barriers**: `workgroupBarrier()` for shared-memory ordering, `storageBarrier()` for storage buffers. **All invocations must reach the barrier** — a barrier inside divergent control flow deadlocks. Real-world data point: for a Blelloch prefix sum on M4 Pro, workgroup size 64 beat 32–256 consistently, and "process 2–4 elements per thread" *regressed*; barrier imbalance dominates. Always sweep, never assume.
- **No ordering guarantees**: you cannot assume workgroups run concurrently, exclusively, or in dispatch order.
- **Subgroups** (`subgroupAdd`, `subgroup_invocation_id`) reduce shared-memory traffic, but `subgroup_size` is runtime-dependent, uniform-per-dispatch, and only bounded to a power of two in 4–128. Feature-detect and keep a non-subgroup path.
- **Profiling**: request the optional `timestamp-query` feature, create a `GPUQuerySet({type:'timestamp'})`, pass `timestampWrites` to the pass descriptor, `resolveQuerySet` into a `QUERY_RESOLVE` buffer, copy to a `MAP_READ` buffer, `mapAsync`, diff the two `BigUint64` nanosecond values. Browsers quantize/jitter timestamps for security — use rolling averages, and warm pipelines before timing.

### B4. Three.js WebGPURenderer

- **Status**: the project's stated focus; `WebGLRenderer` is maintained but receiving no large new features. Still officially **experimental**, with maintainers explicitly warning you may hit missing features or *worse* performance than `WebGLRenderer` depending on scene setup.
- **Async init is mandatory**: prefer `renderer.setAnimationLoop(fn)` (it guarantees init before frame 1) over `requestAnimationFrame`; if you need manual control, `await renderer.init()` first.
- **Known gaps vs `WebGLRenderer`**:
  - `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile` are **unsupported** → all custom shading must be node materials + TSL. This is the biggest migration cost for Shapeland.
  - `EffectComposer` doesn't apply; there's a separate node-based post-processing stack (`PostProcessing`, `pass()`, `mrt()`, `getTextureNode()`), and not every legacy pass has been ported.
  - Alpha blending and post-processing results differ from `WebGLRenderer` even with `forceWebGL: true` — the WebGL2 backend is a *separate* renderer, not a wrapper.
- **Fallback path**: `new WebGPURenderer({ forceWebGL: true })` for testing/exclusion. Maintainers describe basic rendering as "essentially the same" but not a 100% match — so your golden images must be **per-backend**.
- **MRT is first-class**: `mrt({ output: ..., normal: ..., velocity: ... })` with smaller formats to save bandwidth — the right structure for a depth/normal outline prepass plus motion vectors.

### B5. Performance engineering

- **Render bundles** (`createRenderBundleEncoder` → `finish()` → `pass.executeBundles([b])`): commands are fully validated at *encode* time, so validation is skipped at execute. Rules: pipeline/bind-group/vertex-buffer state is **reset before and after** the bundle (bundles inherit nothing and leak nothing), so each bundle must set all its own state. Pack as many draws as possible per bundle. Bundles are static in *commands* but not in *resources* — update the camera uniform buffer between executions and the same bundle draws from the new viewpoint. Only worth it if you reuse across passes/frames; ideal for Shapeland's static world chunks and shadow/outline prepasses that re-draw the same set per view.
- **Uniform vs storage**: uniform buffers are faster for small per-object data (matrices, material constants) but require **fixed-size arrays**. Storage buffers give **runtime-sized arrays**, so for instancing you index `array<Instance>` by `instance_index` and get one draw call for N objects. Split uniforms by update frequency (frame / material / object) so you stop re-uploading the view-projection per object.
- **OffscreenCanvas + worker**: `canvas.transferControlToOffscreen()` → `postMessage(off, [off])`; the worker acquires the WebGPU context and runs its own `requestAnimationFrame`. Zero-copy, one-time. Caveat: workers have no DOM, so input events fire on the main thread — a naive `postMessage` per event adds a frame of latency.
- **SharedArrayBuffer ring buffer**: serve `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`), verify `self.crossOriginIsolated === true`. Then: main thread writes input events into a lock-free SAB ring the sim worker drains at tick start; sim writes double-buffered state into a second SAB that the render worker reads, coordinating with `Atomics.store/load/wait/notify` on a sequence counter. This decouples a fixed-timestep sim from a variable-rate renderer without either blocking. Avoid high-frequency `postMessage` — thousands of small structured clones per second can cost more than the rendering they coordinate.

### B6. Debugging and CI

- **Headless GPU in CI (Linux)**: Playwright ≥1.49 with `channel: 'chromium'` (new headless) plus `--no-sandbox --use-angle=vulkan --enable-features=Vulkan --disable-vulkan-surface --enable-unsafe-webgpu --ignore-gpu-blocklist`. **Important, currently in flux**: Chrome is deprecating SwiftShader, and three.js's own E2E suite has moved from `--use-angle=swiftshader` to **software Dawn via Lavapipe** (`mesa-vulkan-drivers`, `VK_DRIVER_FILES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json`, run under `xvfb-run -a` **headful** because the Vulkan compositor path needs it). Copy that recipe rather than the older SwiftShader guides. WebKit does not support hardware acceleration headless — run it headed under Xvfb.
- **Two CI-specific landmines from that same three.js work**: (1) force `trackTimestamp = false` under software Vulkan — the Inspector/Profiler crashes otherwise; (2) on `device.lost`, **SIGKILL and relaunch the browser** — Dawn's `VkInstance` cannot be recovered in-process, so every subsequent WebGPU init fails identically. Build that into your harness.
- **Golden images**: bake **one Docker runner image** (one font set, one driver, one rendering config) and capture baselines *in that image*. Never mix headed baselines with headless runs, or SwiftShader/Lavapipe output with hardware output — both are "correct" and byte-different. Maintain **separate baselines per backend** (WebGPU vs `forceWebGL`). Compare with a perceptual metric (SSIM or a ΔE-based diff) with a small tolerance rather than exact pixel equality; for cel shading specifically, also assert a *histogram* invariant — a correct 3-band ramp should produce ~3 dominant luminance clusters, which catches accidental filtering regressions that a loose perceptual diff would pass.
- **Shader validation**: WebGPU validates WGSL at `createShaderModule` — surface `compilationInfo()` messages as test failures. Wrap risky sections in `pushErrorScope('validation')` / `popErrorScope()`. Run `naga`/`tint` over authored WGSL as a lint step in CI so shader errors fail fast without a browser.

---

## Could not verify / in flux

- **The "70% global WebGPU coverage" figure and the vendor case studies** circulating in 2026 blog posts trace to a low-quality source containing what appear to be fabricated companies and benchmarks. Treat all specific percentage and speedup claims as unverified; the gpuweb Implementation Status wiki and caniuse are the only sources I'd trust for availability.
- **TSL API surface** is documented but the renderer is experimental; exact signatures (especially post-processing node names, `geometryNode`, and subgroup exposure) have changed across recent releases. Verify against the `TSL.html` doc matching your pinned version.
- **The GLSL→TSL transpiler**: I confirmed it exists and confirmed the specific fixups its output requires, but I did not verify its exact import path or current maintenance state.
- **Chrome/SwiftShader deprecation timeline** and whether the Lavapipe recipe is stable — the three.js PR adopting it is recent and its authors hedged (`🤞`).
- **`prefers-reduced-motion` in three.js** is plain `matchMedia`; there is no framework-level support, so this is convention, not API.
- **Three.js WebGPU postprocessing gaps**: maintainers reference "some effects not yet ported," but I could not obtain an authoritative current list.

## Sources

- TSL spec: https://threejs.org/docs/TSL.html · wiki mirror: https://github.com/mrdoob/three.js/wiki/Three.js-Shading-Language
- TSL authoring/porting: https://threejsroadmap.com/blog/tsl-a-better-way-to-write-shaders-in-threejs · https://threejsroadmap.com/blog/how-to-convert-glsl-shaders-to-tsl · https://threejsroadmap.com/blog/getting-ai-to-write-tsl-that-works
- WGSL: https://webgpufundamentals.org/webgpu/lessons/webgpu-wgsl.html · https://webgpufundamentals.org/webgpu/lessons/webgpu-from-webgl.html · https://github.com/paulgb/wgsl-cheat-sheet · https://www.w3.org/TR/WGSL/
- Toon/outlines: https://threejs.org/docs/pages/MeshToonMaterial.html · https://discourse.threejs.org/t/flatshading-on-buffergeometry-or-imported-model/24241 · https://ameye.dev/notes/edge-detection-outlines/ · https://bgolus.medium.com/the-quest-for-very-wide-outlines-ba82ed442cd9
- Noise/hashes: https://www.reedbeta.com/blog/hash-functions-for-gpu-rendering/ · https://fgarlin.com/blog/gpu-rng/ · https://github.com/danilw/GPU-sin-hash-stability · https://iquilezles.org/articles/warp/ · https://iquilezles.org/articles/fbm/
- Fire/blackbody: https://www.scratchapixel.com/lessons/cg-gems/blackbody/blackbody.html · https://github.com/MMqd/plancks-law-colors · https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html · https://github.com/neilbartlett/color-temperature
- Blending/soft particles: https://discussions.unity.com/t/how-do-i-get-my-additive-particle-effects-to-look-consistent-between-light-and-dark-backgrounds/774556 · https://docs.unity3d.com/6000.2/Documentation/Manual/urp/blending-modes.html · https://github.com/Unity-Technologies/Graphics/blob/master/Packages/com.unity.render-pipelines.universal/ShaderLibrary/Particles.hlsl
- Lightning: https://www.cs.rpi.edu/~cutler/classes/advancedgraphics/S17/final_projects/sam_ian.pdf · https://www.cs.rpi.edu/~cutler/classes/advancedgraphics/S09/final_projects/lapointe_stiert.pdf
- Tone mapping: https://modelviewer.dev/examples/tone-mapping · https://discourse.threejs.org/t/tone-mapping-overview/75204 · https://github.com/mrdoob/three.js/pull/27668
- WebGPU status: https://github.com/gpuweb/gpuweb/wiki/Implementation-Status · https://web.dev/blog/webgpu-supported-major-browsers · https://caniuse.com/webgpu
- WebGPU perf: https://toji.dev/webgpu-best-practices/render-bundles.html · https://toji.dev/webgpu-best-practices/bind-groups.html · https://toji.dev/webgpu-gltf-case-study/ · https://webgpufundamentals.org/webgpu/lessons/webgpu-optimization.html
- Compute: https://webgpufundamentals.org/webgpu/lessons/webgpu-compute-shaders.html · https://yayo1.com/en/blog/webgpu-prefix-sum · https://www.teachme.sh/webgpu/shared-memory
- WebGPURenderer: https://threejs.org/manual/en/webgpurenderer.html · https://github.com/mrdoob/three.js/issues/30024 · https://discourse.threejs.org/t/webgpurenderer-forcewebgl-true-vs-webglrenderer/87805
- CI: https://developer.chrome.com/blog/supercharge-web-ai-testing · https://github.com/mrdoob/three.js/pull/33346 · https://blog.promaton.com/testing-3d-applications-with-playwright-on-gpu-1e9cfc8b54a9
