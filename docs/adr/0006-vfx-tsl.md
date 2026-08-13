# ADR 0006 — CPU fire oracle, TSL VFX, premultiplied alpha

Status: Accepted

## Context

Phase 4 ports fire, lightning, decals, and pooled lights. The prototype authored these as
`ShaderMaterial` GLSL. That path is dead under `WebGPURenderer`. Additive blending is invisible
on a white world.

## Decisions

1. **CPU plume in sim is the oracle.** Buoyancy, cooling, puffing, and the 340 cap live in
   `@shapeland/sim`. GPU compute, when it lands, derives from `(seed, tick, index)` and is never
   read back. Tests assert statistical signatures (mean height, temperature, count), not bits.
2. **TSL only.** Fire discs, lightning ribbons, and decals use `MeshBasicNodeMaterial` node graphs.
   Emissive unlit materials bypass the toon ramp. Noise is PCG (`hash` in TSL), not `sin` hashes.
3. **Premultiplied alpha (`One, OneMinusSrcAlpha`).** Fading to invisible requires RGB *and* A → 0.
   Colored point lights on the white floor are the glow substitute.
4. **Landing VFX is jump/leap only.** `FLAG_AIR_LAND` pulses fire / lightning / physical from the
   armed up face. Rolls while burning leave a scorch trail; they do not re-ignite.
5. **Shake is impact-only.** Fire 0.06, lightning 0.13, physical 0.20, each labelled `// impact:`.
   Chatter and arc aging use wall-clock `dt` so they survive hit-stop.

## Consequences

- World-layer hashes include burn, pulse, scorch, and live fire parcels, so idle goldens regenerate.
- Sim stays transcendental-free: cooling is Euler `T -= T·DT/τ`, necking is a rational Gaussian
  stand-in, spawn directions are Marsaglia discs.
