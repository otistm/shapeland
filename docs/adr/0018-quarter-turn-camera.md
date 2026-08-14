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

1. **Yaw is an integer `0..3`.** Resting offset is `CAM_OFFSET` rotated about Y by table lookup
   (`(x, z) → (−z, x)` per quarter). Pitch 27.4° and distance 20.0 are invariant. Free orbit and
   in-between angles remain excluded.
2. **Turns orbit, they do not snap.** Visual yaw chases the resting index at `CAM_YAW_RATE 8`
   (`1 − e^(−λdt)`), rotating the offset on a circle so distance and pitch stay put. Stick mapping
   uses the resting integer the moment the button is pressed, never the in-flight angle — so a
   mid-turn 45° does not coin-flip the stick. Reduced motion snaps the orbit.
3. **Input is camera-relative at the shell.** `rotateDirMask` maps screen cardinals to world
   cardinals before `sim.hold`. The input log stays world-absolute; a run remains `(seed, inputLog)`
   with no yaw in sim. Stick, hat, WASD, and bumpers all remap from the **resting** yaw, never from
   an in-flight offset.
4. **Occlusion and key light follow the look vector.** `occlusionLift` samples the visual offset
   (axis walk at rest, a short parametric walk mid-orbit). `KEY_LIGHT` rotates with visual yaw so
   the key stays screen-left. Fire billboards already `lookAt` the rig.
5. **Parity.** Touch: **CAM ‹** and **CAM ›** in the existing top-right region. Keyboard: `C` `.` `]`
   clockwise, `Z` `,` `[` counter-clockwise. Gamepad: LB / RB. Equip stays `E` / Start. Camera is
   not a sim button.

## Consequences

- DESIGN.md's exclusion is now **free analog orbit**, not all camera rotation.
- Stick mapping is no longer world-absolute; it is yaw-indexed. Tests encode that table.
- Replays do not store camera yaw. Two players can watch the same log from different facings.
