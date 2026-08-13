# ADR 0005 — Equip is a draft until DONE

Status: Accepted

## Context

Phase 3 is the equip overlay: an unfolded cross net, pointer drag/drop, found-gating, and
persistence. Movement and ability selection stay the same verb — the overlay only *places* glyphs;
rolling still decides what is armed.

## Decisions

1. **Sim stores integers.** Faces are `0..3` (`normal/fire/lightning/physical`) and finds are a
   bitmask. Strings live in `@shapeland/content`.
2. **Drafts live in UI.** Opening copies the committed loadout; DONE is the only commit, and that
   commit is the save. Autosave-on-change is forbidden so the player can experiment.
3. **Found-gating is a sim proof.** `commitFaces` rejects any ability that is not found. A save that
   equips an undiscovered ability is dropped; its legitimate finds still restore.
4. **The net uses sim face indices** so opposite is `f ^ 1`. Layout is the cross: TOP over FRONT,
   LEFT/FRONT/RIGHT/BACK across the belt, BOTTOM under FRONT.
5. **One `drawAbilityFace` authoring point.** Web bakes canvases once and hands them to both the
   presenter and the overlay.
6. **Sandbox finds until Phase 5.** A missing save granted the three elementals so the net was
   playable. **Superseded by ADR 0007:** the shrine is the find.

## Consequences

- Player-layer hashes include faces and found, so idle goldens regenerate.
- HTML5 drag-and-drop is not used; pointer capture with 6px slop plus tap-select/tap-place.
