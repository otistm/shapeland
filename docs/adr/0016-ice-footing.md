# ADR 0016 — Ice does not overwrite swamp or grass

Status: Accepted

## Context

Ice paints a slick patch and a roll onto ice slides. Water, swamp, and grass are surface kinds that
already taught a footing with the body (ADR 0013, ADR 0014). Painting ice onto swamp or grass made
frozen mud slide — a shape that lies (pillar 2). The board-wide audit recorded this as a kill until
Game Design Lead picked melt, lock, or a new frozen-water kind.

## Decision

**Lock.** `icePaint` refuses swamp, grass, gaps, and walls. Dry ground and water still freeze.

- **Water may freeze.** A frozen pond slides. That is what ice looks like; the jump-refuse of open
  water is replaced by ice grammar, which the player can predict from the cyan sheet.
- **Swamp and grass never freeze.** Their rolls already cost tempo (slow / springy). Overwriting
  that with a slide would unsay the lesson.
- Melt stays fire's job. A new "frozen water" kind is a new verb and is cut.

## Consequences

- Freeze AOE on mixed footing paints fewer than 21 cells. Proofs assert the refused cells and that
  a frozen water line still slides.
- Color is still earned: cyan exists only where ice actually painted.
- Socket BFS pins are unchanged.
