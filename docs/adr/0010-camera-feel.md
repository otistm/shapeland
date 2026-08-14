# ADR 0010 — Eases belong to bodies; the camera tracks the lattice

Status: Accepted

## Context

The roll ease pulses cube velocity 0 → ~7 → ~4 → 0 at 5.26Hz. A camera that follows the eased
position inherits that pulse; no first-order filter can remove it. Tracking `pos.y` bobbed the view
on every roll because the arc lift lives there. Phase 8 is the feel pass that makes this structural.

## Decisions

1. **Horizontal feed is linear roll progress** (`start + dir · t/dur`), never `rollEase`. Measured
   RMS velocity ripple on a one-cell roll is 0 for the camera feed and > 0.5 u/s for the body.
2. **Vertical feed is resting ground height.** Mid-roll that is `destY`; mid-air the landing column.
   Flat ground gives exactly zero camera bob. Terrace climbs ease at `CAM_CLIMB 4.5`.
3. **Look-ahead is exp-smoothed.** `CAM_LOOKAHEAD 0.85` toward the current roll/leap, rate 4/s, as
   `1 − e^(−λdt)` — not the prototype's `min(1, dt·4)`, which settled 2.4× faster at 144Hz than at
   60Hz.
4. **Traversal never writes shake.** `stepCamera` only decays. Impacts call `impactShake` (≥ 0.05,
   labelled `// impact:`). Decay `e^(−7.5 dt)` hits a hard floor at 0.004 so tails do not dither.
5. **One kick spring.** Physical landings subtract `CAM_KICK_PHYS 2.8` from kick velocity; stiffness
   90 / damping 12 recover on the camera's Y only. Reduced motion zeroes shake and kick.

## Consequences

- `cameraTarget` is the only sanctioned camera input. Presenter look-at uses `rig.target`, which
  already includes look-ahead.
- Height-8 columns on the +Z look vector add `occludeY`, exp-smoothed with `CAM_FOLLOW`, from
  resting cell heights only. Traversal still never writes shake.
- Hit-stop (sim dt scaled while shake stays on wall-clock) remains deferred; it is presentation
  punctuation, not a camera-feed invariant.
