# Architecture & Construction — Research Brief for Shapeland

**Scale contract:** player cube = 1 unit (u); treat **1u ≈ 2 m**. All real dimensions below are converted by dividing metres by 2. Movement budget: roll 1 cell, leap a 2-cell gap, step up 1u. That budget defines the world's grammar: **1u = passable, 2u = wall, 3u+ = cliff.**

---

## 1. Composition Fundamentals as Rules

- **Proportion.** φ = 1.618. Le Corbusier's Modulor is a φ-ladder anchored to the body: Red series 27, 43, 70, 113, 183, 296 cm; Blue series 53, 86, 140, 226, 366 cm (navel 1.13 m, head 1.83 m, raised hand 2.26 m = 2 × 1.13). In units this collapses to a **preferred set: 1, 2, 3, 5, 8, 13, 21, 34, 55** (Fibonacci ≈ φ). **Rule: every authored dimension comes from that set or from 1, 2, 4, 8, 16, 32.**
- **Classical orders = a height/width table.** Column height in base diameters: Tuscan 7:1, Doric 7–8:1, Ionic 8–9:1, Corinthian 10:1. Vitruvian intercolumniation in diameters: pycnostyle 1.5, systyle 2, eustyle 2.25 (preferred), diastyle 3, araeostyle 4+. **Voxel form: a pier of footprint d stands 7d–10d tall, spaced 2.25d–3d on centre.**
- **Ken/tatami modularity.** The ken (Tokyo 1.82 m, Kyoto 1.97 m) sizes the tatami at 1 ken × ½ ken, and the mat then governs rooms, bays and ceiling heights. **Name rooms by integer tile count, never by arbitrary rectangle.**
- **Bay rhythm.** A-A-A-A reads imperial, A-B-A-B decorative, **A-A-B-A-A hierarchy — the B bay holds the door, altar or seal.** Widen it by exactly one module.
- **Symmetry vs asymmetry.** Ching: the axis "implies symmetry but demands balance." **Symmetry = intent (sealing authority, shrines, gates); asymmetry = time (ruin, erosion).**
- **Mass vs void.** Solid:void by mood — fortress 80:20, temple 60:40, ruin 40:60. A 1-cell notch in a 20-cell wall is that wall's loudest element.
- **Axis and procession.** An axis "induces movement and promotes views" and **must be terminated at both ends by a significant form**: a 40-cell avenue is only an axis if a 20u mass closes it.
- **Compression and release** (Frank Lloyd Wright): narrow/low/dark feeding large/bright makes the second space read far bigger than measured. **Recipe: 1 wide × 2 high for 6–10 cells, then open to 16+ wide × 12+ high — a ≥6× volume jump.**
- **Prospect–refuge.** Cave then outlook, in sequence: **every safe node gets 3 closed sides plus one long sightline out.**
- **Enfilade.** Align door cells to one row index across N chambers so the player reads a complex's full depth from the first threshold.
- **Thresholds.** Change one variable per transition — ceiling drops 2u, *or* floor rises 1u, *or* width halves. Three at once is noise.

## 2. Communicating Function Without Signage

Wayfinding practice (Lynch 1960 — paths, edges, districts, nodes, landmarks) treats signage as "a bandage for a deeper design problem." Translations for a world whose only variables are FORM, HEIGHT, SHADOW and (rarely) COLOR:

| Real cue | Shapeland equivalent |
|---|---|
| Entrance hierarchy | Primary entrance is **2× the width and 2× the height** of any secondary one in the same structure, and projects 2u from the wall plane |
| Material change underfoot | **Height change** — a 1u recess or plinth marks a district edge; the player feels it as a step |
| Light as direction | **Shadow geometry** — a 20u tower's shadow is a directional arrow; a 4u light-well drops a bright pool exactly where the player should stand |
| Accent colour | **Color is earned and rationed.** One colored cell in a 10,000-cell white field is the loudest signal available — spend it only on seals |

- **Shape carries meaning alone:** cube = stable/institutional/safe, pyramid and spike = danger, stepped dome = sacred. Naughty Dog's *Invisible Intuition*: shape consistency **is** the affordance system.
- **Openings and light attract** — inverted here, **players walk toward shadow contrast**, so a deep recess reads as a door and a shallow one as decoration.
- **Denial of view.** Show a landmark, occlude it 30–60 cells, reveal from a new angle. Highest-yield landmark technique in both the ND talk and FromSoftware approach work.

## 3. Structure and Load Paths

- **Compression vs tension.** Masonry is strong in compression, weak in tension. **Post-and-lintel** works by bending — the lintel's underside goes into tension, capping stone spans. **Rule: unsupported lintel ≤3u looks right, 5u is the limit before it reads fake.**
- **True arch** converts load into compression along a thrust line that must stay in the **middle third** of the masonry, and generates **lateral thrust**; without abutments the supports spread and it fails. **Rule: span S needs solid mass ≥ S/2 each side.** Flying buttresses redirect thrust to ground and need a pinnacle's dead weight to steepen the resultant.
- **Corbelling — the critical cube technique.** Courses offset inward until bridged by a capstone. A *false* arch: each stone cantilevers, producing bending rather than pure compression, so it demands **massive backing**. Newgrange (3200–2500 BC), the Great Pyramid's Grand Gallery, Mycenae.
- **Anti-cheat math.** Block-stacking (Leaning Tower of Lire): one block per level gives max overhang ½·H_n block lengths — **1 cube = 0.5u, 2 = 0.75u, 3 = 0.92u, 4 = 1.04u, 10 = 1.46u; 4u needs 31 blocks, 10u needs 12,367.** Multi-block levels only reach order n^(1/3) (proved ≤ 6n^(1/3)). **Rule: max 1 cell step-out per course, backing mass ≥3× projecting mass** — a 4-cell corbel needs 12+ cells of backing over ≥4 courses.
- **Trusses** turn bending into pure tension/compression members: a stepped zig-zag lattice, the only honest long span. **Plausible ≠ actual** — players only check whether something sits under the heavy mass, whether mass tapers upward, and whether overhangs have visible backing.

## 4. Construction and Modular Practice

- **Dimensional coordination.** ISO 2848 / ISO 21723: **basic module M = 100 mm** (4 in), preferred multimodules 300 and 600 mm, large dimensions preferring multiples of 3, 6, 12, 15, 30, 60 M, submodular ¼M and ½M. Openings are drawn **larger** than modular size and components **smaller**, to absorb tolerance. **Keep large dimensions to 3, 6, 12, 15, 30, 60.**
- **Kit of parts.** Fix a vocabulary — wall segment, pier, lintel, stair flight, corbel course, plinth, parapet, gate — each sized from the preferred set. Author parts and place them, never one-off geometry.
- **LEGO/voxel constraints.** Cantilevers are the top cause of stability failure; support stress = weight × length, linear. An upper floor extending 4 studs past the wall below **is** a 4-stud cantilever. Remedies: more connection points, lighter projecting mass, hidden internal supports, corbelling.
- **Bonds communicate structure.** **Running bond** (half-unit offset per course) interlocks and distributes load — reads *load-bearing, old, real*. **Stack bond** aligns all vertical joints, has no interlock and needs reinforcement in reality — reads *veneer, inert*. **Use running-bond coursing on structural mass and stack bond on monoliths and seals: the pattern tells players which surfaces obey physics and which are magic.**
- **Stair geometry.** Blondel: **2R + T = 550–700 mm, ideal ≈630 mm** (imperial 24–25 in, the "7-11 rule"). IRC: max riser 7¾ in, min tread 10 in. UK: riser 150–220, going 220–300, max pitch 42° (38° public). NCC 2022: riser 115–190, going 240–355, **max 18 risers per flight.** Comfortable pitch 30–37°.
- **The 1-unit staircase is not a staircase.** 1 rise : 1 run = 45°, 2R+T ≈ 6 m — steeper than any code allows. Treat it as the native ladder-ramp and vary the tread: **1:2 (26.6°, Quake's ramp standard) = grand stair, 1:3 (18°) = processional ramp, 1:1 = service climb.** Break flights every **8–13 risers with a 2-cell landing.**

## 5. Level Architecture in Games

- **Metrics first.** Measure player size, speed, step height and jump distance in-engine, then derive every gap and ledge. **Minimum hallway = at least 2× player width, and even that feels tight.** Character reference 180 cm.
- **Reference numbers.** Unreal: doors 110 × 220 cm, min hall 150, walls 300, steps 15 × 25. Unity: doors 125 × 250, min hall 200. Quake (units ≈ inches): hull 32×32×56, min hall 33, min ceiling 57, **recommended hall 128+, ceilings 64/128/256+, rooms 256/512/1024+, stairs 16 rise : 32 run, max step 18, max running jump 244.**
- **Greybox discipline.** Build in untextured primitives at true scale; validate flow, sightlines and reachability before art. Safe gap = 0.7 × max jump, hard gap = 0.95 ×. **Shapeland: required paths use 1-cell gaps, 2-cell only for optional routes and skill checks.**
- **FromSoftware — four reusable techniques.**
  1. **Layered sightlines.** From the Anor Londo cathedral roof the player sees at once the main door, the buttresses (risky route to the giant archers), the cathedral interior, and ground already conquered — "more than ten lines of dialogue could deliver."
  2. **Density zoning.** Stormveil's Cliffside / Grafted Hall / training-grounds cluster carries the routes, shortcuts and hidden rooms while the avenue before the boss is deliberately sparse; Anor Londo uses three dense volumes joined by simple paths. **One maximum-density node per region.**
  3. **Directional legibility.** Sen's says "always up," the Catacombs "always down" — a consistent vertical direction lets players map confusing geometry. Miyazaki designed Sen's as a "trap road" so arriving at Anor Londo felt earned, and signposted the traps (worn, rounded steps where boulders roll).
  4. **Multi-entry interlock.** Stormveil has **six entrances/exits** and "a nest of interlocking routes from the outer walls to the innermost cloisters" — a destination that is really a corridor between regions.
- **The one-glance test.** At every threshold, one screen must answer: where can I go, where is the goal, what is dangerous. Landmarks need **unique silhouettes**; block broad shapes before detail.

## 6. Monumentality and the Sublime

- **Scale is comparison, never absolute size.** (1) **Foreground occluders** — a 2u parapet in front of a 40u tower proves the tower. (2) **Atmospheric perspective** — use a *value* gradient: distant mass lightens toward sky, near mass holds crisp shadow. (3) **Repeated modules** — a 40u wall in countable 1u courses reads as 40 people tall; a smooth one is unreadable.
- **Boullée and Ledoux** reduced architecture to "elementary geometric solids — the sphere, the cube, and the pyramid," working through "scale, symmetry, sharp lines, and bare surfaces." Boullée's 1784 **Cenotaph for Newton: a hollow sphere ~150 m (500 ft) across, taller than the Pyramids, on a stepped circular base, interior holding a tomb and empty space, "light would be its only ornament."** At 1u ≈ 2 m that is a **75u stepped sphere on a stepped base** — a ready-made monolith-shrine template.
- **Architecture parlante** ("speaking architecture") = form alone explains function, which is literally Shapeland's brief. **Assign each function a solid: sealing authority = cube and stepped pyramid; sacred = stepped dome; danger = spike/inverted cone; ruined = broken prism.**
- **Brutalism** supplies surface logic: unrelieved mass, repetition, deep reveals, sharp arrises. **Shadow depth is the only available ornament** — cut 1-cell reveals at Fibonacci intervals so raking light makes rhythm.
- **Kojima staging.** *Death Stranding* sets "massive, sharp-edged BRIDGES buildings" against desolate brutalist blocks and vast emptiness, so architecture reads as institutional dominion, and topography doubles as puzzle (a peak is an obstacle until it becomes a zipline anchor). **Steal the contrast: long empty traversal punctuated by a sudden hard-edged intrusion.**

## 7. Shapeland Metrics (unit cubes)

**Hard constants:** step-up 1u (walkable) · wall 2u (blocks) · cliff 3u+ (region edge, one-way drop) · max leap 2 cells → **required gap 1 cell, skill-check gap 2 cells.**

**Circulation (width × height):** crawl/secret 1×1 · service 1×2 · standard 2×3 (= 2× player width, the stated minimum) · primary 3×4 (odd width gives a centre axis) · processional 5×8 · grand axis 8×13 (one per region).

**Doorways** — a primary entrance doubles both dimensions of the secondary: utility 1×2 · standard 2×3 · public 3×5 · monumental gate 5×8 · sealed portal 8×13, recessed 2u, flanked by 2×2 piers 14–20u tall.

| Chamber | Plan | Height | Notes |
|---|---|---|---|
| Shrine / cell | 3 × 5 | 5 | φ plan, refuge, 3 sides closed |
| Antechamber | 5 × 8 | 6 | Compression stage |
| Hall | 13 × 21 | 12 | Release stage, ≥6× antechamber volume |
| Arena / cathedral | 21 × 34 | 21 | Bays 5–6u, A-A-B-A-A rhythm |
| Sealed vault | 8 × 8 | 34 | Vertical sublime, one light-well |

**Vertical:** stair flight 8–13 risers then a 2-cell landing · slopes 1:1 service, 1:2 grand, 1:3 processional · lintel ≤3u (5u max) · corbel ≤1 cell/course with ≥3× backing mass, ≥4 courses · arch span S needs S/2 abutment each side · pier footprint d → 7d–10d tall, 2.25d–3d spacing.

**Landmarks and sightlines:** minor marker **8–13u**, readable at 40 cells · regional monolith **21–34u**, at 100 cells · world seal **55–89u** (≈110–180 m), at ~250 cells. Reveal cadence: show → occlude 30–60 cells → re-reveal from a new angle, ×3. Every safe node needs one 60+ cell prospect. Course every surface over 8u in visible 1u bands so height stays countable.

---

## Sources

- Ching, *Architecture: Form, Space and Order* Ch.7 — https://ia801505.us.archive.org/28/items/ArchitectureFormSpaceAndOrderCh7/Architecture_Form%20Space%20and%20Order_Ch7.pdf ; lecture deck on axis — http://users.etown.edu/w/wunderjt/Architecture%20Lectures/ART370%20Ching%20CH7%20PRINCIPLES.pdf
- Compression and release — https://en.wikipedia.org/wiki/Compression_and_expansion ; prospect–refuge in Wright (JAABE) — https://www.jstage.jst.go.jp/article/jaabe/1/1/1_1_297/_pdf
- Modulor series and anchors — https://gridmakerpro.com/learn/le-corbusier-modulor-explained/ ; https://gridmakerpro.com/grids/architecture-grids/le-corbusier-modulor/ ; *The Modulor* preview incl. ken/tatami — https://api.pageplace.de/preview/DT0400.9783035604092_A24916917/preview-9783035604092_A24916917.pdf
- Classical orders — https://en.wikipedia.org/wiki/Orders_(architecture) ; Vitruvius III.3 intercolumniation — https://lexundria.com/vitr/3.3/mg ; Vitruvius IV — https://www.perseus.tufts.edu/hopper/text?doc=Perseus%3Atext%3A1999.02.0073%3Abook%3D4 ; Britannica — https://www.britannica.com/technology/intercolumniation
- Post and lintel — https://en.wikipedia.org/wiki/Post_and_lintel ; https://www.britannica.com/topic/architecture/Post-and-lintel
- Arch thrust, middle third, abutments — https://civengtech.com/types-of-architectural-arches-a-comprehensive-guide-to-design-history-and-engineering/ ; corbel arch — https://en.wikipedia.org/wiki/Corbelled_arch
- Block-stacking / Leaning Tower of Lire — https://en.wikipedia.org/wiki/Block-stacking_problem ; https://mathworld.wolfram.com/BookStackingProblem.html ; max overhang ≤ 6n^(1/3) — https://math.dartmouth.edu/~pw/papers/maxover.pdf
- LEGO cantilever/overhang physics — https://theearlofbricks.com/blog-studio-stability-checker/ ; clutch and friction — https://www.buildsteam.com/home/friction-part-ii-cantilever-and-supports
- ISO 2848 modular coordination — https://en.wikipedia.org/wiki/ISO_2848 ; standard text — https://cdn.standards.iteh.ai/samples/7846/a86382c91b96433da03b947608e0c2d0/ISO-2848-1984.pdf ; ISO 21723:2019 — https://standards.iteh.ai/catalog/standards/iso/b9b95c64-d302-4489-b72b-82c26a4b289f/iso-21723-2019 ; NBS survey — https://www.govinfo.gov/content/pkg/GOVPUB-C13-dbfc0c2959817b8c5904d1001a935af6/pdf/GOVPUB-C13-dbfc0c2959817b8c5904d1001a935af6.pdf
- Stairs: 2R+T / Blondel — https://engineerfix.com/what-is-the-stair-formula-explaining-2r-t/ ; 7-11 rule — https://www.staircasecalculator.com/what-is-the-7-11-rule-for-stairs/ ; IRC R311.7 — https://www.jaspector.com/codes/irc-2018/ch03-building-planning/stairway-tread-riser-handrail-details-irc-2018/ ; UK/US + 2R+G 550–700 — https://calcpros.com/handy/staircase-calculator ; NCC 2022 Part 11.2 — https://www.abcb.gov.au/editions/ncc-2022/adopted/housing-provisions/11-safe-movement-and-access/part-112-stairway-and-ramp-construction
- Level Design Book blockout metrics — https://book.leveldesignbook.com/process/blockout/metrics ; Quake metrics — https://book.leveldesignbook.com/process/blockout/metrics/quake ; UE5 scale guide — https://www.worldofleveldesign.com/categories/ue5/guide-to-scale-dimensions-proportions.php
- David Shaver (Naughty Dog), *Invisible Intuition* — https://www.davidshaver.net/DShaver_Invisible_Intuition_DirectorsCut.pdf
- Anor Londo sightlines — https://www.socratopia.app/library/game-design-compelling-en/chapter-15 ; Stormveil/Anor Londo/Sen's density and directionality — https://medium.com/@bramasolejm030206/preface-ec08bc1459d0 ; Sen's Fortress design intent (Miyazaki interview) — https://www.pcgamesn.com/dark-souls-remastered/sens-fortress-trap-house ; Stormveil interlock — https://www.gamespot.com/articles/how-stormveil-castle-embodies-the-brilliance-of-elden-ring/1100-6510147/ ; six entrances — https://cathalcrumley.substack.com/p/stormveil-castle-tarnished-architecture
- Boullée & Ledoux, the sublime — https://publicdomainreview.org/essay/designing-the-sublime/ ; Cenotaph for Newton — https://chiselandmouse.com/pages/cenotaph-for-isaac-newton-architecture ; architecture parlante — https://en.wikipedia.org/wiki/Architecture_parlante
- Wayfinding without signage / Lynch — https://www.40city.com/articles/wayfinding-is-not-signage ; https://plotstuff.com/knowledge-base/what-is-wayfinding ; https://www.cannondesign.com/perspectives/five-human-variables-shape-wayfinding-buildings ; interior wayfinding review — https://pmc.ncbi.nlm.nih.gov/articles/PMC7677306/
- Kojima / *Death Stranding* brutalist staging — https://bulletpointsmonthly.com/2020/01/15/unearthly_forms/ ; mountains as platforms — https://doi.org/10.1515/9781399519991-020
