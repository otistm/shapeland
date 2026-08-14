# ADR 0013 — Water and swamp are surface kinds, not height tints

Status: Accepted

## Context

The sketch dungeon generator painted height 0–2 as “water/swamp.” That lies: a taller cell is not
wetter, and a blue floor on dry lattice is decorative hue (pillar 3). ADR 0012 correctly cut that
legend. The verbs still belong in Shapeland — as **walkable surface kinds**, independent of height,
with a body lesson each (pillar 4) and a TSL tell that is material, not a tint.

## Decisions

1. **`Terrain.setWater` / `setSwamp`.** Packed xz sets, like gaps. Mutually exclusive with each
   other, with `gap`, and with grass (ADR 0014). Height is unchanged. A gap clears water/swamp; water
   cannot occupy a gap.
2. **Water: wet footing.** Walkable at dry roll tempo. Jump and leap refuse from a water cell
   (`FLAG_REFUSE`). Ice freeze may still paint a wet cell; a slide is still a slide.
3. **Swamp: sticky footing.** Walkable. Entering a swamp cell costs `SWAMP_ROLL_TICKS` (35, ~1.52× a
   dry roll). Jump is allowed. No extra quarter-turn.
4. **Water is Wallace's substance; swamp is still a sheet.** Water is one pooled instanced TSL
   mesh per wet region (`MeshBasicNodeMaterial`, premultiplied alpha), rest surface at
   `WATER_SURFACE` so a unit cube is in the volume. The gold standard is Evan Wallace's WebGL
   water (https://madebyevan.com/webgl-water/): a heightfield carrying `(h, v, n.x, n.z)`, wave
   equation, `moveSphere` volume coupling against the cube, `addDrop` on land, vertex
   displacement, peaked field normals, Fresnel between the refracted floor and the reflected sky,
   Jacobian caustics **on the pool bottom**, and Wallace sphere physics on **visual Y**
   (`percentUnderWater`, buoyancy, quadratic drag). Sim still owns wet footing (dry roll tempo,
   jump/leap `FLAG_REFUSE`). Cell, orientation, and camera rest-height stay integer — the field is
   never read back into sim. Reduced motion freezes ripples and buoyancy; the dimple and waterline
   stay. Swamp is a static mud sheet.

   Water is two stacked layers, because that is where the demo's look actually comes from: a
   **pool floor** sheet on the terrain top carrying the caustic ribbons and depth tint, and a
   **surface film** at `WATER_SURFACE` that refracts it. The film is thin face-on
   (`WATER_SURFACE_ALPHA` 0.34) so the floor and the submerged cube read through, and rises to
   `WATER_ALPHA` at grazing angles. Water quads are full cells; the inset used by dry sheets would
   leave slits in a substance. The below-water pass is deferred — this camera cannot get under a
   0.38 puddle, so it would be dead code.

   **The shading normal must come from the field.** The first pass took it from `fbm2` while the
   geometry was displaced by the field, so the cube's dimple and wake were invisible in the
   lighting and the water still read as a textured sticker. Noise is now a tilt on the field
   normal, which also keeps a frozen puddle readable under reduced motion.

   Three constraints were found by measuring the real backend, and each is now a test:

   - **Noise lattice must be biased positive.** `hash()` seeds through `uint()`, and `uint()` of a
     negative float is undefined in GLSL and WGSL. On a signed grid every negative cell hashed
     identically, so the sheet was a flat constant. `NOISE_LATTICE_BIAS` fixes this for fire too.
   - **Clock and displacement are different stages.** A clock uniform read by both the vertex and
     the fragment stage lands in two uniform buffers, and only one is re-uploaded on the WebGL2
     fallback. Vertex displacement reads the heightfield, never the clock.
   - **Per-frame uniforms go through `onFrameUpdate`.** A plain `.value` write leaves the object
     uniform buffer clean. Render still owns the value; the hook only marks it dirty.
   - **The caustic Jacobian is a function of floor xz, never of screen-space derivatives.**
     `dFdx`/`dFdy` follow the camera's pixel axes — diagonal under the quarter-turn yaw — and
     jump at every triangle edge of the tessellated film. That painted the water with fine
     diagonal hatching. Wallace samples a finished caustic texture; we evaluate the same
     `oldArea/newArea` mapping one field texel apart in world xz. Field samples pin `level(0)`
     so implicit LOD cannot hatch the displaced mesh either.

   `positionWorld` is not available as a sheet's noise domain: it derives from `positionLocal`, so
   reading it while assigning `positionNode` is self-referential and drops the instance transform.
   Noise stays on `aCell + uv()`. Displacement is `positionLocal + (0,0,fieldHeight)`. The water
   shader still needs a real world-space point for the view ray, so the resting surface height
   travels as an `aBase` instance attribute instead. The quad is rotated `-π/2` about X, so local
   +y maps to world **−z**; getting that sign wrong slides the whole field sideways under the cube.
   A vertex-stage texture sample needs an explicit `level(0)` — there are no derivatives there.
5. **Color is earned as material.** In-game water `#2e5461` and swamp `#4a5244` exist only on those
   cells — saturation on white, distinct from ice cyan. The authoring viewer may use the same hues
   as a legend; it must not recode height 0–2 as wet.
6. **The Blank bake includes puddles.** `generateBlank` proposes 4-neighbor puddles off the shrine
   spine. `blank-stamp.ts` must equal that bake. Socket BFS pins stay.
7. **Wet cells stay 2 clear of every gap.** Water refuses jump, so a wet gap rim could be the only
   launch pad for a required leap. Forbidding it is cheaper than proving each layout safe.

## Consequences

- Frame budget line: `water: 3` ms, raised from 1 (heightfield step, volume coupling, tessellated
  refracting surface, caustic floor).
- Proofs: exclusivity, jump refuse, swamp duration, bake equality, every wet cell roll-reachable,
  no wet cell on a gap rim, crest/caustic colour clear of ice and of near-white, Wallace Jacobian
  (`refract` + world-xz finite differences, never `dFdx`/`dFdy`), cube volume coupling carves a dimple and restores on leave, wave
  energy bounded, field normals unit-length and tilting away from the dimple, the surface shading
  reads `normalFromInfo` and not the noise height, caustics drawn by the floor material, film
  alpha thinner than the floor, clock stays out of `positionNode`, buoyancy bounded within
  `WATER_SINK_MAX` and never lifting above rest, and `camera.ts` never reads `waterBob`.
- Fire shares the biased noise lattice, so its fbm gains detail in negative-domain regions.
