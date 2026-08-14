# Role Charters

Industry-grounded definitions of what each lead owns. Each Shapeland role skill in
`.cursor/skills/` is the *applied* version of one of these charters; this document is the
reference they share.

Notation: **O** = owns exclusively · **D** = deliverables · **M** = judged on · **X** = conflicts
and resolution · **F** = failure modes. Titles marked *[non-standard]* are described via their
closest real industry role.

---

## Game Director

**O** — What the game *is*: pillars, experience target, quality bar, and the final call on
cross-discipline trade-offs and cuts. Creative authority, not schedule. **D** — Pillars doc,
"razors" (decision heuristics), greenlight/kill decisions, review notes, milestone demo content
list. **M** — Coherence of the shipped experience against stated pillars; whether the team can make
decisions *without* them. **X** — Producer over scope vs schedule (director cuts content rather
than lowering the quality bar); every lead when ambition exceeds budget, resolved at a standing
review with a written verdict. **F** — Becoming a decision bottleneck; vision so abstract it
generates drift; re-direction churn after production lock.

## Lead Game Designer

**O** — The systems layer: core loop, economy and progression math, rule sets, which mechanics
exist, and the tuning *ranges* other disciplines fill. **D** — Systems docs, tuning tables,
prototypes, feature briefs with success criteria, playtest plans. **M** — Whether the loop tests as
fun, whether systems are teachable, late-production tuning stability, spec clarity measured by
rework per feature. **X** — Programmers over who owns tunable values (data to designers, runtime to
code); Director over scope (Director wins). **F** — Designing on paper without prototypes;
over-specifying implementation instead of intent; treating balance as a launch-week task.

## Lead Level Designer

**O** — Playable space: layout, pacing, critical path, sightlines, encounter placement, navigation
clarity, and the level design metrics table. **D** — Blockouts, metrics document, POI/beat maps,
encounter scripts, review checklists. **M** — Playtest completion and wayfinding data, rework after
art pass, per-level performance. **X** — Environment art over composition vs playability, resolved
by a **locked blockout gate**: art starts only after gameplay sign-off; World Builder over regional
boundaries. **F** — Blockouts that die in art pass because metrics were ignored; over-scripted
moments that break systemically; polishing geometry before layout is validated.

## Lead Architect *[non-standard; industry equivalent: Technical Director / Principal Engine Programmer]*

**O** — System boundaries, data flow, module dependencies, tech selection, and the "can we build
this" verdict. Owns technical risk and long-term maintainability. **D** — Technical design docs,
architecture diagrams, ADRs, coding standards, performance and memory budget allocation, risk
register, spike prototypes. **M** — Build stability, iteration time, whether late features land
without rewrites, budget adherence, defect density in core systems. **X** — Feature leads pushing
speed over structure, resolved by explicitly time-boxing prototype code and scheduling the
hardening pass; Director on ambition, resolved via feasibility spikes not opinion. **F** —
Over-architecting before the design is known; under-owning performance until it is a crisis;
building bespoke tech where off-the-shelf would ship.

## Lead Visual Effects Artist

**O** — VFX look *and* the VFX cost budget: particle counts, overdraw, shader complexity per effect
class, texture memory. **D** — VFX style guide, master materials, effect libraries, per-effect
budgets, previs for key moments. **M** — Frame time contributed by VFX, readability of
gameplay-critical effects, consistency across effect families. **X** — Graphics programmer over
shader ownership (artist owns authored materials, programmer owns pipeline and the profiling
verdict); Combat Designer over telegraph clarity vs spectacle (**design wins on readability**).
**F** — Beautiful effects that obscure gameplay reads; budget blowouts found at cert; authoring
against an unfinished lighting/tonemapping setup.

## Lead Motion Graphics Artist *[non-standard; equivalent: Lead UI Motion Designer]*

**O** — The motion language of the interface: timing, easing curves, transition states, feedback
choreography, and the reusable motion component library. **D** — Motion spec with durations and
curves, animated prototypes, production animations, motion design system docs. **M** — Perceived
responsiveness (input-to-feedback latency), UI frame cost, reuse rate, whether motion survives
implementation unchanged. **X** — UI Designer over expressiveness vs clarity (UX owns usability,
motion owns feel; skip-ability is the usual compromise). **F** — Motion that delays the player;
one-off animations that don't scale; specs delivered as video with no implementable numbers.

## Lead 3D Animator

**O** — Motion quality and the animation systems layer: state machines, blend trees, IK, root
motion policy, and **the responsiveness contract** (frames until the character obeys input).
**D** — Style guide and quality bar, rig/export standards, locomotion and combat sets, graph
structure, animatics for new abilities. **M** — Input lag frames, blend and foot-slide artifacts,
memory budget, readability of attack telegraphs. **X** — Combat Designer over frame data (design
owns startup/active/recovery windows, animation owns how the pose reads within them — **frame data
is the shared contract**). **F** — Beautiful animation that fights input; authoring before frame
data is locked; state machine sprawl nobody else can debug.

## Lead 3D Artist

**O** — Execution of the visual target: asset budgets (tris, texel density, materials, draw calls,
LODs), modular kit design, asset acceptance. The *Art Director* owns the target; the Lead owns
hitting it on schedule. **D** — Art specs, modular kits, **gold standard** assets, outsourcing
briefs, review checklists. **M** — First-pass approval rate, budget compliance, visual
consistency, throughput. **X** — Art Director over "good enough" (Director arbitrates);
engineering over budgets (profiling, not debate). **F** — Assets that fail engine integration; no
gold standard so the team calibrates on nothing; the lead doing hero assets instead of unblocking.

## Lead Building Architect *[applied skill: brutalist-architecture]*

**O** — How buildings are generated: brutalist axioms, archetypes, interior volumetric zoning, and
the eight-step massing sequence. Distinct from Lead Architect (technical director) and from Lead
CAD Developer (the generators). **D** — Massing protocol, kit members (`core`, `thickRing`, cave,
fins), axiom audit. **M** — Whether a structure reads as load-bearing mass you enter. **X** —
CAD over cantilevers (honest piers win; theatrical float is a pillar-2 lie); Level Design over
interior flow. **F** — Decorating a butte and calling it a building; 1-cell fences as civic mass;
mirrored civic blocks.

## Lead CAD Developer *[not standard; equivalent: Lead Procedural/Houdini Technical Artist]*

**O** — Procedural and parametric asset generation systems, and the data path from authoring tools
into the engine. In CAD-adjacent work: B-rep/NURBS tessellation, decimation, auto UV/collision/LOD,
metadata preservation. **D** — Parametric generators, batch conversion pipelines, validation rules,
parameter docs, exported kits with LODs and collision. **M** — Assets generated per hour, share of
generated output shipping without fixup, **determinism of regeneration**, engine-side performance.
**X** — 3D artists who feel blocked by parameter-only control, resolved by making output
editable/bakeable. **F** — Generators only their author can operate; over-proceduralizing content
that needs handcraft; pipelines that lose art-directable control.

## Lead Narrative Designer

**O** — How the story is *delivered*: narrative systems (dialogue, flags, barks, environmental
storytelling), pacing of beats against gameplay, content structure. Distinct from Lead Writer, who
owns prose. **D** — Narrative design docs, quest flowcharts, dialogue system specs,
state-management schema, beat maps aligned to regions. **M** — Narrative comprehension in
playtests, content throughput, **break rate of narrative state** (a top source of late bugs).
**X** — Level/World design over where beats land, resolved by joint beat mapping in preproduction.
**F** — Story written before the delivering systems exist; combinatorial state explosion;
narrative that requires the player to stop playing.

## Lead World Builder

**O** — The macro world: region layout, terrain, biome distribution, landmarks, roads, POI density
and spacing, travel times, and the world's composition seen from a distance. Where Level Design
owns a space's *purpose*, World Building owns the **connective tissue and scale**. **D** — World
map and region briefs, terrain passes, POI distribution plans, landmark and vista compositions,
streaming/cell layout. **M** — Exploration metrics (dead zones, discovery rate), traversal pacing,
streaming performance, silhouette legibility. **X** — Level Designers over shared-region
boundaries, resolved by an **ownership map** with one named owner per box. **F** — Beautiful empty
space; POIs distributed evenly rather than dramatically; terrain locked before traversal mechanics
are final.

## Lead Combat Designer

**O** — The combat contract: frame data (startup/active/recovery), hitbox and hurtbox definitions,
i-frames, stamina/poise, damage and enemy stat curves, enemy archetypes and AI intent, and the
feedback stack (hitstop, shake, knockback). **D** — Combat design doc, tuning tables, archetype
specs, move lists with frame data, encounter guidelines, prototype scenarios. **M** — Time-to-kill
distributions, **readability** (can players identify and react to a telegraph in ~200–300ms), input
responsiveness, difficulty curves from telemetry, exploit-free-ness. **X** — Animation over frame
data; Combat Engineer over where tuning lives; VFX over telegraph legibility. **F** — Balancing on
spreadsheets rather than in-hand; stacking feedback until combat is unreadable; enemy variety by
stat scaling instead of behavior.

## Lead QA

**O** — Test strategy and the quality signal: test plans, entry/exit criteria, **severity**
classification, regression scope, release-readiness recommendation. QA owns severity; product owns
priority. **D** — Master test plan, test suites, smoke and regression checklists, bug database
hygiene rules, triage cadence, release risk report. **M** — Escape rate (bugs found by players),
defect density, critical-path coverage, repro quality, report-to-verified cycle time. **X** —
Everyone, via "it's not a bug, it's design", resolved by triage with a named decision-maker and
**written expected-behavior specs**. **F** — Being treated as a gate instead of a signal; testing
only what is easy to test; no written expected behavior, so QA argues opinion.

## Lead Product Manager

**O** — Why a feature is worth building and how success is measured: KPI definitions, roadmap
prioritization, experiment design. Standard in live-service; thinner in premium single-player,
where it often merges into production. **D** — Roadmap, feature briefs with target metrics,
dashboards, experiment plans, funnel analyses, post-launch cadence. **M** — Retention (D1/D7/D30),
engagement, forecast accuracy. **X** — Designers over "fun vs metrics" (designers own mechanics, PM
owns business outcomes, Director arbitrates); Producer over sequencing (PM owns what/why, Producer
owns how/when). **F** — Optimizing vanity metrics; feature requests without hypotheses; overriding
design intuition with underpowered data.

## Lead Physics Engineer

**O** — Simulation correctness, stability and cost: timestep policy, collision representation
standards, **determinism guarantees**, physics performance budget. **D** — Character controller,
constraints, profiling reports, physics debug tools, determinism/replay tests. **M** — Stability
(no explosions, tunneling, jitter), frame-time cost and worst-case spikes, determinism where
required. **X** — Designers who want unphysical behavior for feel, resolved by separating "gameplay
movement" from "simulation" — most action games do not simulate the player. **F** — Chasing realism
the game doesn't need; non-determinism discovered after replays depend on it; collision authoring
rules published too late to fix content.

## Level Design Engineer *[industry title: Technical Level Designer]*

**O** — The technical substrate level designers work in: prefabs and templates, scripting patterns,
spawners, triggers, streaming setup, and the technical standards content must meet before handoff.
**D** — Reusable template libraries, validation tooling, scripting docs, technical review of
designer-built content, level performance profiles. **M** — Designer iteration speed, level-content
bug rate, perf compliance, adoption of shared templates over bespoke setups. **X** — Gameplay
programmers over script vs code, with the typical rule: **promote to code when reused more than
three times or when it appears in a profiler hotspot**. **F** — Building tools nobody adopts;
becoming the only person who can debug level scripting; letting one-off hacks accumulate.

## Combat Engineer *[non-standard; equivalent: Gameplay Programmer (Combat)]*

**O** — The combat runtime: hit detection and resolution order, input buffering and cancel windows,
ability state machines, damage pipeline. Owns *how* the designer's contract executes and how tuning
is exposed. **D** — Combat systems code, data schemas for moves, **in-engine debug visualizers**
(hitboxes, frame counters, state readouts), tuning hot-reload, regression tests for edge cases.
**M** — Input latency and frame accuracy, absence of exploits, CPU cost per combatant, designer
iteration time without engineering help. **X** — Combat Designer over tuning ownership, resolved by
designer-editable data tables. **F** — Hardcoding tuning; no debug visualization, forcing design to
guess; systems too rigid to accept new move archetypes late.

## Technical Designer

**O** — The bridge: rapid prototypes, exposing tunables, and the technical health of
designer-authored content. Owns being **first tester** of new features and translating design needs
into engineering requirements. **D** — Playable prototypes, scripted implementations,
editor-exposed parameters, workflow docs, feature specs in engineering-usable terms. **M** —
Prototype turnaround time, **design team autonomy** (how often designers need a programmer),
quality of requirements handed to engineering. **X** — Gameplay programmers over prototype code
quality; norm is that prototype code is **disposable by agreement**, with a separate scheduled
productionize task. **F** — Prototype code silently shipping; drifting into junior-programmer work
and abandoning design judgment; becoming a single point of failure.

## Lead Programmer

**O** — Delivery of the engineering team's work: task breakdown and estimates, code review
standards, branch/build policy, technical quality within the project. Distinct from Technical
Director (studio-level strategy); the Lead owns **execution**. **D** — Sprint plans and estimates,
review standards, build/CI health, technical debt register, postmortems. **M** — Green-build
percentage, estimate accuracy, crash rate, review latency, team throughput. **X** — Producers over
estimates, resolved with buffered estimates and explicit risk callouts; Architect over deviations
from standards. **F** — Coding instead of leading; accepting scope without renegotiating quality or
time; letting broken builds become normal.

## Lead Audio Engineer / Audio Director

**O** — Sonic identity and **the mix**: audio pillars, bus structure, loudness targets, dynamic mix
states (combat vs explore), ducking and priority rules, voice-count and memory budgets. **D** —
Audio direction doc, middleware project structure, SFX/music libraries, implementation standards,
mix sessions, loudness compliance report. **M** — Mix clarity (can players hear gameplay-critical
cues under load), loudness consistency, audio CPU/memory/voice budgets. **X** — VFX/Combat over
what is "loud" in a moment, resolved by an explicit **priority hierarchy in the mixer** rather than
per-asset volume fights. **F** — Making assets without implementing them; mixing in isolation
instead of in gameplay context; leaving the mix pass to the last weeks.

## Lead Boss Designer *[rarely standalone; normally an encounter/combat design specialization]*

The standard framing is **Encounter Designer**. Regardless of title it owns: boss movesets and
phase structure, telegraph vocabulary and punish windows, arena layout requirements, difficulty
escalation, and the learn-curve — **a boss should be beatable by pattern recognition, not
memorization**. **D** — Boss docs with per-attack frame data and counterplay, phase transition
specs, arena requirements handed to level design, retry-loop specs (checkpoint, run-back, load
time). **M** — Attempt-to-clear distributions, whether players describe deaths as **fair**,
telegraph readability, quit rate at the encounter. **X** — Level Design over arena ownership;
Animation over telegraph length. **F** — Difficulty via stats or camera abuse instead of readable
patterns; unreadable phase two; punishing run-backs that convert challenge into tedium.

## Lead UI Designer

**O** — Information architecture and interaction: user flows, screen hierarchy, input mapping and
navigation model, HUD content and priority, accessibility plan, and the component/design system.
**D** — Wireframes, flows, interactive prototypes, UI style guide and component library,
accessibility spec, implementation specs. **M** — Task success and time-on-task in usability tests,
first-session comprehension, accessibility conformance, component reuse, UI performance. **X** —
Art Direction over aesthetics vs legibility (**usability testing is the tiebreaker**); Motion over
flourish vs speed; designers wanting to solve design problems with tooltips. **F** — Designing
screens instead of flows; ignoring controller/keyboard parity until late; a HUD that grows by
accretion as every system demands a corner.

## Tools Engineer

**O** — Internal developer-facing software: editor extensions, asset import pipelines, build and CI
automation, and the **usability** of all of it. Distinct from gameplay engineers by *audience* —
their users are teammates. **D** — Tools, automated pipelines, asset validators, documentation and
training, telemetry on tool usage and failure. **M** — **Iteration time (edit-to-see-in-game)**,
build times and reliability, adoption rate, support volume, hours saved per week. **X** —
Production over tools-vs-features, resolved by quantifying iteration cost. **F** — Building what
users asked for instead of what they needed; tools with no error messages or docs; deprioritizing
tooling until iteration cost is already fatal.

---

## The friction seams that cause the most damage

**Designer vs engineer on tuning values.** Engineers own the *runtime and schema*; designers own
the *values*. Values live in data with hot-reload, never in code. **If a designer must file a
ticket to change a number, the seam is broken.** Corollary: engineers own the clamps that keep a
value from breaking the simulation.

**Level designer vs world builder.** Level Design owns *purposeful space* (built for a specific
experience). World Building owns *continuous space* (terrain, roads, POI distribution, travel
pacing, streaming). Resolve with an ownership map: every square has exactly one named owner. World
Building sets the frame and metrics; Level Design fills the boxes; both defer to shared traversal
metrics.

**Technical designer vs gameplay programmer.** Prototype code is **disposable by default**; any
prototype that survives gets a scheduled productionize task with an engineering owner. Escalation
rule: reused more than ~3 times, or visible in a profiler hotspot, means it graduates to code.

**VFX artist vs graphics programmer.** Artists own authored materials and the look; programmers own
render passes, shader compilation, the profiler, and the verdict on cost. The resolution mechanism
is a **budget, not an argument** — an agreed per-frame ms and memory allocation, with profiling
data as arbiter. When an effect exceeds budget, **the artist chooses what to cut**.

**QA vs everyone.** "Bug vs intended behavior" is a *specification* failure, not a QA failure.
Resolutions: every feature ships with written expected behavior; QA owns severity and product owns
priority; a named triage owner per area with a fixed cadence, so nothing is arbitrated by whoever
argues longest.

---

## Definition of done, per discipline

"Done" always means **integrated, verified in the build, and within budget** — never "delivered to
someone else."

- **Design** — spec written, prototype validated in playtest, values in data with tuning ranges,
  edge cases enumerated, telemetry hooks in.
- **Level/World** — blockout signed off before art starts; final pass meets metrics, collision
  valid, streaming and per-view budgets met, playthrough recorded without blockers.
- **Engineering** — code reviewed, tests where applicable, no new warnings, profiled against its
  budget, debug visualization present, smoke suite green.
- **Art/VFX** — matches style guide and gold standard, within budgets, LODs and collision present,
  reviewed **in engine under game lighting**, naming valid.
- **Animation** — frame data matches the design contract, blends clean at all entry states, root
  motion verified on target terrain, memory budget met.
- **Audio** — implemented in middleware, mixed **in gameplay context**, states wired, within voice
  and memory budgets, loudness compliant.
- **UI** — flows implemented for all supported inputs, accessibility checks pass, shared components
  used, tested against long localized strings, no perf regression.
- **QA** — test cases written, executed and recorded; bugs have repro steps, evidence and build
  info; fix verified and closed.

---

## How director authority actually works

Direction in practice is **consensus with a fallback to veto**, not a chain of orders. The standard
mechanism set is **pillars** (3–5 statements of intended experience, usable by anyone to evaluate a
feature), **razors** (short decision heuristics — "does it make you feel like a wandering
ronin?"), and **gold standards** (a built example that shows the bar rather than describing it).
Directors spend most of their time communicating vision so that hundreds of daily decisions are
made correctly *without* them.

Veto is real but expensive: use it on **coherence violations, not taste**. Formal authority lands at
**gates** — concept, prototype, vertical slice, alpha (feature complete), beta (content complete),
release candidate. Each gate has written falsifiable criteria. The **vertical slice is the
canonical greenlight moment**: it proves art direction, core loop and tech working together at ship
quality in miniature, and it marks the end of adding major new ideas. Gate decisions are binary:
proceed, iterate, or kill.

---

## Small teams and agents holding several hats

- **Merge along natural seams, not across them.** Safe: game + combat design; level + world
  building; technical design + tools; VFX + technical art; UI design + UI motion; narrative +
  writing; lead programmer + architect. **Dangerous:** any maker being the sole QA of their own
  work, and any single agent holding both vision and schedule authority — those two roles exist to
  check each other.
- **Separate the hat from the person.** When one agent holds several roles, require it to state
  which role it is acting in for a given decision and record the trade-off explicitly. This
  preserves the argument that would otherwise happen between two people.
- **Write the contracts down, because you cannot ask across the desk.** Frame data tables, level
  metrics, asset budgets and expected-behavior specs are how disciplines stay aligned without
  meetings. On small teams these matter *more*, not less.
- **One vision holder, always.** Even at two people, someone must be able to say no.
- **Budget before you build.** Agree ms-per-frame and memory allocations in preproduction;
  retroactive optimization is the most common small-team death spiral.
- **Gold standard first.** One polished example of each content type before scaling.
- **Automate the QA that repeats.** Smoke tests, validators and build health checks substitute for
  the QA headcount a small team lacks; reserve judgment-based testing for humans.

---

## Sources

- Game Developer, *Types of Designers* — https://www.gamedeveloper.com/design/types-of-designers
- Game Developer, *Design Pillars – The Core of Your Game* — https://www.gamedeveloper.com/design/design-pillars-the-core-of-your-game
- Game Developer, *The 5 Stages of Greenlight* — https://www.gamedeveloper.com/business/the-5-stages-of-greenlight-how-to-know-when-it-s-time-to-launch-your-game
- Game Developer, *Why you need a Technical Designer* — https://www.gamedeveloper.com/design/why-you-need-a-technical-designer
- Ubisoft, *Lead Level Design (AAA Project)* — https://jobs.smartrecruiters.com/Ubisoft2/744000140062699-lead-level-design-f-m-nb-aaa-project-
- Ubisoft, *Lead Technical Level Designer* — https://gamejobs.co/Lead-Technical-Level-Designer-F-M-NB-AAA-Project-at-Ubisoft
- Avalanche Studios, *World Designer* — https://jobs.lever.co/avalanchestudios/872fcdbb-41af-4777-acc0-a6be22ef04d5
- 2K / Cloud Chamber, *Lead VFX Artist* — https://gamejobs.co/Lead-VFX-Artist-at-2K-7750
- Guerrilla Games, *Studio Technical Director* — https://jobera.com/job/guerrilla-games-studio-technical-director-3253b861/
- Naughty Dog, *Physics Programmer* — https://gamejobs.co/Physics-Programmer-at-Naughty-Dog-3686
- Bungie, *What's a tools engineer?* — https://www.bungie.net/7/en/News/article/50492
- ScreenSkills, *Tools engineer* — https://www.screenskills.com/job-profiles/browse/games/programming/tools-engineer/
- Voodoo, *Senior Technical UI & Motion Designer* — https://jobs.ashbyhq.com/voodoo/7ceb7481-56e0-4db7-94fb-494e132908c7
- Berklee, *Audio Director* — https://www.berklee.edu/careers/roles/audio-director
- Audiokinetic, *Creating a Bus Structure (Wwise 201)* — https://www.audiokinetic.com/en/courses/wwise201/?id=lesson_8_mixing_creating_bus_structure
- *Practical Game Design* — greenlight gates and vertical slice — https://www.oreilly.com/library/view/practical-game-design/9781787121799/13771f24-21e0-412a-b801-92e3d0a1a441.xhtml
- GDC, *Creative Direction for Ghost of Yōtei* (Sucker Punch) — https://schedule.gdconf.com/session/does-it-make-you-feel-like-a-wandering-ronin-creative-direction-for-ghost-of-ytei/915861
- GDC, *Great Level Design is a Studio-Wide Effort* (Arkane) — https://www.youtube.com/watch?v=UrdZhnA-PaI
- Ask a Game Dev, *The Combat Designer* — https://www.tumblr.com/askagamedev/76654905524/what-kind-of-designer-should-i-be-the-combat
- DigiPen, *Game Design Disciplines: Technical Design* — https://www.digipen.edu/showcase/news/digipen-game-design-disciplines-explained-technical-design
