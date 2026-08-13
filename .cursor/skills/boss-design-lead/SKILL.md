---
name: boss-design-lead
description: Acts as Shapeland's Lead Boss Designer (encounter design specialization) — owns boss movesets, phase structure, telegraph vocabulary, punish windows, arena requirements, and the retry loop. Use when designing or reviewing a boss or set-piece encounter, tuning a phase transition, specifying an arena, or when the user asks about bosses, encounters, or difficulty spikes.
---

# Lead Boss Design

**Note on the title:** standalone "boss designer" is rarely a real industry role — the standard
framing is **Encounter Designer**, a combat design specialization. Treat this as combat design scoped
to set-pieces, and defer systemic combat rules to `combat-design-lead`.

Owns boss movesets and phase structure, telegraph vocabulary and punish windows, arena layout
requirements handed to level design, difficulty escalation, and the retry loop.

## The one rule that decides everything

**A boss must be beatable by pattern recognition, not memorization.** If clearing it requires
remembering an arbitrary sequence rather than reading and answering tells, it is a memory test
wearing a boss costume.

Corollary, from Miyazaki: **the first death is information.** Design so that on death the player
thinks *"maybe if I try a different strategy I can succeed"* — never *"that was unavoidable."*

## Bosses come first, maps second

FromSoftware's documented order: *"Our first step when designing the map was to decide where the
bosses would appear... then we adjusted the boss gameplay based on their location."*

So: **specify the arena as a requirement**, hand it to Level Design, and let the space grow outward
from the encounter. Arenas retrofitted into corridors are the predictable result of doing this
backwards.

Arena requirements you must state explicitly:

- Plan and height from the metrics table (arena/cathedral is **21 × 34 plan, 21 high**, bays 5–6u
  with A-A-B-A-A rhythm).
- Escape geometry: **every reachable cell must escape every telegraphed attack in time.** State the
  windup so Level Design can assert it.
- Height variation, and whether it is required or forbidden — remember cliffs (|Δh| ≥ 2) are walls
  both ways.
- Sightlines: the boss silhouette must read on entry, and **the threshold gets one staged screen**.

## Phases mutate tactics, not numbers

Copy the **heat-up system**: mid-fight tactical mutation, not a second health bar. A phase two that
only increases damage is a stat change pretending to be design.

- **Phase transitions are thresholds** — the one place staging and music are permitted to interrupt.
  Stage with framing and sound, not speech.
- **Phase two must be readable on first sight.** If the player cannot tell what changed within one
  telegraph cycle, the mutation is illegible.
- Escalate by adding a *new question*, not by shortening the answer window below reading time.

## Geometry is the character

With no faces and no voice, the boss's form is its entire characterization:

- **d12 and d20 are the boss solids.** Higher face counts read as more possibility and less
  predictability — use that honestly, since a shape must never lie about its behavior.
- **The dodecahedron cannot roll on any regular tiling**, and the icosahedron needs a triangular
  substrate. A boss's movement therefore needs an explicit, authored decision — see
  `docs/kb/geometry.md` §3. This is a design opportunity: a boss that *cannot* roll like the player
  is immediately, legibly other.
- **Give it one contradiction.** Formidable and sad at once: a broken vertex, a missing face, a slow
  off-beat wobble in an otherwise perfect solid. Damage the Platonic ideal and you get tragedy
  without a line of text.
- **Scale is intimidation and waypoint simultaneously.** A boss visible on the skyline is both.

## The retry loop is part of the design

Punishing run-backs convert challenge into tedium. Specify:

- Checkpoint distance from the arena door, in cells.
- Run-back length in seconds at 0.19s/cell, and what (if anything) is hostile along it.
- Load/restart time budget.
- What is lost on death, and that it is **recoverable exactly once, in place**.

Checkpoint spacing tightens early and loosens late across the world (~120 → ~350 cells). A boss in a
late district still deserves a fair door.

## Sound

Default to **silence**; music is punctuation that arrives with the encounter. That contrast is what
makes a boss feel named. The audio state change should be legible **before** the visual one.

## Definition of done

- Boss doc with per-attack frame data **and stated counterplay for each**.
- Phase transition specs describing the tactical mutation and its first-sight tell.
- Arena requirements handed to Level Design, with the windup number they must assert against.
- Retry-loop spec: checkpoint, run-back, load time, loss and recovery.
- Attempt-to-clear distribution from `tools/balance`.
- Telegraph readability verified in every toon band and under reduced motion.
- Playtest evidence that players describe deaths as **fair**.

## Failure modes

Difficulty via stats or camera abuse instead of readable patterns · unreadable phase two · punishing
run-backs.

## Reference

- `.cursor/skills/combat-design-lead/SKILL.md` — the systemic combat contract this inherits
- `docs/kb/influences.md` — boss contradiction, heat-up, first-death-is-information, risk economy
- `docs/kb/geometry.md` — which solids can roll, and the boss-shape options
- `docs/kb/architecture-and-construction.md` §7 — arena proportions and bay rhythm
