# Shapeland Knowledge Base

Research-backed reference material. Every document separates **sourced fact** from **folklore** and
flags what could not be verified. Role skills in `.cursor/skills/` link here rather than restating.

## Domains

| Document | Covers |
|---|---|
| [physics.md](physics.md) | Fixed timestep, determinism in TypeScript, integrators, movement without a physics engine, springs and smoothing, grid collision, plume physics, physics testing |
| [geometry.md](geometry.md) | The 24 cube orientations, the parity theorem, verified roll tables, rolling-puzzle complexity, polyhedra as behavior grammar, SDFs, computational geometry |
| [architecture-and-construction.md](architecture-and-construction.md) | Proportion and procession, structural load paths, corbelling math, modular coordination, stair geometry, FromSoft spatial techniques, monumentality, **the Shapeland metrics table**, brutalist generation protocol |
| [level-design.md](level-design.md) | The five terrain rules, blockout workflow and gates, reachability and socket proofs, pacing audit, the one-glance test, encounter placement |
| [open-world-pacing.md](open-world-pacing.md) | What the "30–40 second rule" actually is, landmark theory, POI density, FromSoft and Kojima world structure, **Shapeland's cell-distance budgets** |
| [shaders-and-webgpu.md](shaders-and-webgpu.md) | Part A: TSL, WGSL, toon ramps, noise, blackbody fire, lightning, compute particles, post. Part B: WebGPU support, cost model, compute, WebGPURenderer, headless CI |
| [engines-and-tools.md](engines-and-tools.md) | ECS design, engine architecture, editor and tooling patterns, content pipelines, replay and observability, test infrastructure, WASM, solvers, monorepo DX |
| [influences.md](influences.md) | Miyazaki and Kojima design philosophy as ~38 applicable rules, where they conflict, and how to express both in pure geometry |
| [roles.md](roles.md) | What each lead owns, deliverables, metrics, friction seams, definition of done per discipline, small-team practice |

## How to use this

1. **Read the domain doc before designing in that domain.** These exist so nobody rediscovers a
   lesson the repo already contains.
2. **Cite it when you make a claim.** "Per `open-world-pacing.md`, POI ceiling is 211 cells" is
   reviewable; "it feels sparse" is not.
3. **Correct it when reality disagrees.** These are living documents. If a playtest or a profile
   contradicts a number here, update the number *and* note what measurement changed it.
4. **Respect the flags.** Sections marked unverified are genuinely unverified. Do not promote them
   to fact by citing them.

## Conventions

- Numbers in **cells** and **ticks** are canonical. Metres and frames are advisory conversions.
- Time-based pacing bands are scale-independent and therefore authoritative; metre conversions
  depend on the unresolved cell-to-metre scale (see `../DESIGN.md`, Open Questions).
- Anything asserted as provable ships with the proof, not with prose.

## Tools

`tools/verify-cube-group.mjs` generates and proves the cube rotation group, the roll tables, the
parity law, and the 19×19 BFS reachability claims. Run it with `node tools/verify-cube-group.mjs`;
it is the executable form of `geometry.md` section 1.
