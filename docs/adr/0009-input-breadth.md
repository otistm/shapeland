# ADR 0009 — Axis-lock is grammar, and Y is not A

Status: Accepted

## Context

Phase 7 is input breadth: the cube only rolls on world axes, so every analog source has to tell
that truth. The Gamepad API is a level snapshot with no events, and in a permissions-policy iframe
`navigator.getGamepads` exists yet throws `SecurityError` on every call.

## Decisions

1. **One axis.** Touch D-pad and pad stick lock to the larger component; the other is zeroed. Ties
   prefer X, matching `dirFromMask`. An SVG plus-frame, not a circle. Touch dead zone 0.36, pad
   0.38, travel `STICK_R 40`.
2. **Hat beats stick.** A hat press is unambiguous; a deflected stick is not.
3. **Y speaks; A jumps / confirms.** Sharing confirm with jump swallowed jumps beside the Keeper.
   Start/Select opens equip. Edge-detect grouped buttons by visiting every index (a loop, never
   `.some`), or a held later button misfires on the next poll.
4. **Pulse jump/pivot from the pad.** Keyboard may hold the bit; the pad mask carries those bits for
   one frame so a hold through a modal cannot rising-edge the sim on close. Modal capture keeps the
   movement mask at 0.
5. **One call, one info line, permanent disable.** Feature-detecting `getGamepads` is not enough.
   The first throw logs once and the session never retries.
6. **`body.pad` announces connection.** Touch UI fades; button badges appear. The footer hint is
   rewritten every frame, so connection uses the banner.

## Consequences

- Analog lock lives in sim (`analogToMask`) so qa-dpad runs without DOM. Polling, policy, and touch
  binding live in platform. HUD never imports platform.
- Screen cardinals become world cardinals via `rotateDirMask` after a camera quarter-turn (ADR 0018).
  Analog lock still happens in view space first.
- Full remapping and pivot hold/toggle options remain deferred.
