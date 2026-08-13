# ADR 0002 — Three.js WebGPURenderer and TSL toon

Status: Accepted

## Context

Phase 1 needs a real renderer. The stack contract is WebGPU-first with WebGL2 fallback, and
custom shading must be TSL because `ShaderMaterial` / `onBeforeCompile` do not run under
`WebGPURenderer`.

## Decisions

1. **Pin `three@0.180.x`.** Import the GPU build from `three/webgpu` and TSL from `three/tsl`.
   Do not import `three/src/renderers/WebGLRenderer`.
2. **One material factory.** `makeToon()` is the only constructor for lit surfaces. It builds a
   `MeshToonNodeMaterial` with the shared 3-texel ramp `[0.62, 0.84, 1.0]`, `NearestFilter`,
   `NoColorSpace`. Roughness and metalness are stripped.
3. **Probe, then init.** `WebGPURenderer.backend` lies before `await renderer.init()`. Capability
   selection is `forceWebGL: !WebGPU.isAvailable() || urlHasGl`. Query `?gl=1` forces the fallback
   for CI and goldens.
4. **Tone mapping is Khronos PBR Neutral.** No bloom. White clear, fog `42/110`.
5. **`toNonIndexed` has exactly one call site.** Faceted toon normals are a build-time bake, not a
   per-mesh habit.
6. **Golden images are per-backend.** E2E captures the WebGL2 fallback (`?gl=1`) so CI does not
   silently mix software-Dawn WebGPU with hardware WebGPU.

## Consequences

- Adding a standard material is a regression.
- A three.js minor bump is a visual-suite event, not a drive-by upgrade.
