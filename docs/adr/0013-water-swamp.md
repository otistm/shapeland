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
4. **Render animates; sim does not.** Water is one pooled instanced TSL sheet per surface kind
   (`MeshBasicNodeMaterial`, premultiplied alpha, PCG `hash` noise), anchored to `terrain.height`.
   The readable tell is a **moving crest band in the fragment stage**; there is no vertex
   displacement, so instancing stays stock and the camera cannot follow a wave. Reduced motion
   stops advancing the clock, leaving a still, readable wet sheet. Swamp is a static mud sheet.

   Three constraints were found by measuring the real backend, and each is now a test:

   - **Noise lattice must be biased positive.** `hash()` seeds through `uint()`, and `uint()` of a
     negative float is undefined in GLSL and WGSL. On a signed grid every negative cell hashed
     identically, so the sheet was a flat constant. `NOISE_LATTICE_BIAS` fixes this for fire too.
   - **One stage only.** A clock uniform read by both the vertex and the fragment stage lands in
     two uniform buffers, and only one is re-uploaded on the WebGL2 fallback.
   - **Per-frame uniforms go through `onFrameUpdate`.** A plain `.value` write leaves the object
     uniform buffer clean. Render still owns the value; the hook only marks it dirty.

   `positionWorld` is not available to a sheet: it derives from `positionLocal`, so reading it while
   assigning `positionNode` is self-referential and drops the instance transform. Sheets take their
   noise domain from `aCell + uv()`, which is continuous across the cells of one puddle.
5. **Color is earned as material.** In-game water `#2e5461` and swamp `#4a5244` exist only on those
   cells — saturation on white, distinct from ice cyan. The authoring viewer may use the same hues
   as a legend; it must not recode height 0–2 as wet.
6. **The Blank bake includes puddles.** `generateBlank` proposes 4-neighbor puddles off the shrine
   spine. `blank-stamp.ts` must equal that bake. Socket BFS pins stay.
7. **Wet cells stay 2 clear of every gap.** Water refuses jump, so a wet gap rim could be the only
   launch pad for a required leap. Forbidding it is cheaper than proving each layout safe.

## Consequences

- Frame budget line: `water: 1` ms.
- Proofs: exclusivity, jump refuse, swamp duration, bake equality, every wet cell roll-reachable,
  no wet cell on a gap rim, crest colour clear of ice and of near-white, and the three render
  mechanisms in decision 4.
- Fire shares the biased noise lattice, so its fbm gains detail in negative-domain regions.
