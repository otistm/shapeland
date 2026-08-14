# ADR 0018 — Quarter-turn camera yaw, not free orbit

Status: Accepted

Verdict: **proceed**

## Context

DESIGN.md and the slice plan excluded "free camera / rotation" because a fixed yaw-0 camera keeps
stick mapping absolute and bakes orientation into cheap systems. That exclusion targeted **analog
orbit** — live yaw near ±45°/±135° makes axis-lock a coin flip, and a per-frame basis recompute
would retune lighting, occlusion, and input together.

Players still need to turn the view so a landmark behind the camera is in front of them, without
tilting the lattice. A 90° snap keeps every grid line screen-horizontal or screen-vertical.

## Which pillar is at stake

**Geometry is grammar** (pillar 2). The board is a square lattice. A camera that sits on a diagonal
makes that grammar lie.

## Decisions

1. **Yaw is an integer `0..3` for input.** Resting offset is `CAM_OFFSET` rotated about Y.
   Pitch 27.4° and distance 22.0 (zoom 1) are the authored rest. Button turns are quarter-steps.
   Right-stick X yaws analog; `rotateDirMask` still uses the nearest quarter so axis-lock does not
   coin-flip. Pitch stays fixed. Zoom scales the offset uniformly (`CAM_ZOOM_MIN`–`MAX`), never FOV.
2. **Button turns orbit, they do not snap.** Visual yaw chases the resting index at `CAM_YAW_RATE 8`
   (`1 − e^(−λdt)`), rotating the offset on a circle so distance and pitch stay put. Stick mapping
   uses the resting integer the moment the button is pressed, never the in-flight angle. Reduced
   motion snaps button turns. Analog stick bypasses the chase while deflected.
3. **Input is camera-relative at the shell.** `rotateDirMask` maps screen cardinals to world
   cardinals before `sim.hold`. The input log stays world-absolute; a run remains `(seed, inputLog)`
   with no yaw in sim.
4. **Occlusion and key light follow the look vector.** `occlusionLift` samples the visual offset
   (axis walk at rest, a short parametric walk mid-orbit). `KEY_LIGHT` rotates with visual yaw so
   the key stays screen-left. Fire billboards already `lookAt` the rig.
5. **Parity.** Touch: **CAM ‹** and **CAM ›**. Keyboard: `C` `.` `]` clockwise, `Z` `,` `[`
   counter-clockwise. Gamepad: LB / RB quarter-turns, right stick analog yaw, LT zoom out, RT zoom
   in. Equip stays `E` / Start. Camera is not a sim button.

## Consequences

- DESIGN.md's exclusion is now **free analog orbit**, not all camera rotation.
- Stick mapping is no longer world-absolute; it is yaw-indexed. Tests encode that table.
- Replays do not store camera yaw. Two players can watch the same log from different facings.
