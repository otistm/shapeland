# ADR 0014 — Grass is springy footing, not a green tint

Status: Accepted

## Context

The terrain generator already proposes water and swamp as **surface kinds** (ADR 0013). A green
height-band or a lawn painted onto white floor would be decorative hue (pillar 3) and would lie
about geometry (pillar 2). Grass still belongs — as a walkable meadow with a body lesson on the
same axis as swamp: **tempo**.

## Decisions

1. **`Terrain.setGrass`.** Packed xz set, like water and swamp. Mutually exclusive with `gap`,
   `water`, and `swamp`. Height is unchanged. A gap clears grass; grass cannot occupy a gap.
2. **Grass: springy footing.** Walkable. Entering a grass cell costs `GRASS_ROLL_TICKS` (18, ~0.78×
   a dry roll). Jump is allowed. No extra quarter-turn.
3. **Meadows may sit on terraces and beside gaps.** Jump still works, so a grass rim is a legal leap
   pad. Wet cells stay 2 clear of gaps (ADR 0013); grass does not inherit that restriction.
4. **Render is a static TSL sheet.** Sage `#5e7044` with fragment-only fbm grain, same instancing
   path as swamp. No vertex displacement, no clock. Color exists only on grass cells.
5. **The Blank bake includes meadows.** `generateBlank` proposes 4-neighbor patches off the shrine
   spine and `SLICE_RESERVE`. `blank-stamp.ts` must equal that bake. Socket BFS pins stay — they
   count moves, not ticks.

## Consequences

- Frame budget line: `grass: 0.5` ms (static sheet, one instanced draw).
- Proofs: exclusivity with swamp/gap, `GRASS_ROLL_TICKS`, jump allowed, bake equality, every grass
  cell roll-reachable, grass never on a gap or wet cell.
- Ice freeze may still paint a grass cell; a slide is still a slide. Frozen meadow is the same open
  call as frozen mud.
