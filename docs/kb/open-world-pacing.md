# Open World Pacing and Navigation

The "30–40 second rule", landmark theory, and the numbers Shapeland actually uses.

---

## 1. What the "30–40 second rule" actually is

**There is no single canonical rule.** The phrase conflates three unrelated things. Getting this
right matters, because otherwise agents implement folklore as law.

### Well-sourced: CD Projekt Red's 40-second rule (the real one)

Bartosz von Ochman, Living World Design on *The Witcher 3*, in Noclip's *Designing The World of
The Witcher 3*: "We did some tests and we found the player is focused on the stuff which we
produce. Every forty seconds they should see something and focus on it, like a pack of deer or
some opponents, some NPCs wandering about."

Note the actual claim: **visible, attention-capturing life — not a reward, not a quest, not loot.**
It is a *stimulus* budget, not a *payoff* budget. This is the only studio-attributed number in the
family.

### Well-sourced but a different rule: Ubisoft's 30-second rule

*Assassin's Creed Origins* director Ashraf Ismail described a 30-second rule about **historical
accuracy**: if someone can find a fact in 30 seconds or less, the game stays true to it. Citing
Ubisoft for a 30-second *pacing* beat is a misattribution.

### Well-sourced but a different rule: Bungie's "30 seconds of fun"

Jaime Griesemer: "In Halo 1, there was maybe 30 seconds of fun that happened over and over and
over again." Its origin is the GDC 2002 talk *The Illusion of Intelligence*, which split
responsibility so **AI owned the 30-second timescale** and **mission designers owned the 3-minute
timescale**. The real structure is nested: **~3s inner loop → ~30s mid loop → ~3min outer loop.**
This nesting is the most transferable idea in the whole cluster.

### Nintendo's real rule is spatial, not temporal

At **CEDEC 2017** (not GDC), Hidemaro Fujibayashi and Makoto Yonezu presented the **Triangle
Rule** for *Breath of the Wild*. Triangles do two jobs: **offer a binary choice** (over or around)
and **occlude sightlines** to set up surprise. Three scales were used:

- **Largest** — landmarks and visual markers.
- **Medium** — view-blockers hiding what is behind.
- **Smallest** — tempo control, changing which buttons the player is pressing.

**Rectangles** were used where they wanted *total* concealment rather than gradual reveal. This is
the single most directly applicable finding for a cube-grammar world.

### How it is measured, and what shipped games actually do

Stopwatch-on-footage. Cojanu & Jaber (2021) timed POI intervals in *Witcher 3* and found all
averages under 40s — but for players travelling mounted or running, intervals were **closer to 20s
than 40s**. A 2023 Uppsala replication on *Genshin Impact* found averages of **4.1s, 7.4s, and
9.3s**. Conclusion: **40s is an upper bound for a slow walker; shipped modern density runs
5–15s.**

### Folklore — do not cite as doctrine

- That Bethesda has a stated rule that "you can always see something interesting."
- That Nintendo used a 30- or 40-second rule.
- That Rockstar publishes a density metric.
- That "the 30–40 second rule" is one industry-wide law with one origin.

---

## 2. Landmark and navigation theory

**Kevin Lynch, *The Image of the City* (1960)** — five elements of the mental map: **paths**,
**edges**, **districts**, **nodes** (enterable foci where paths converge, offering perspective on
other elements), and **landmarks** (non-enterable reference points, unique in context). His
operative term is **legibility**, and his method — asking people to draw the map from memory — is
directly reproducible as a playtest instrument.

**The lighthouse / weenie.** Bethesda's Joel Burgess (GDC 2011) names Disney's Cinderella Castle
as the archetype: it is *not a ride*, it is an orientation device **and a planning hub**, because
from its forecourt you can see other landmarks you had missed. Three additional attractors:

- **Motion has direction.** Streams flow, flags flap, smoke rises. Bethesda deliberately placed
  something interesting where a creek ended, "because we consider it likely that players will
  follow the stream."
- **Real-world knowledge beats game convention.** Roads, signposts, campfire smoke — these work
  on non-gamers too.
- **Sound as an off-screen attractor.** Discovered by accident in *Fallout 3* when streamed-in
  combat at the load radius made players "turn on a dime to investigate." Carried into *Skyrim*
  deliberately.

**Occlude and reveal.** BotW's CEDEC slides show a **chain of interest**: hill → bridge → tower,
where each object hides the next, so arriving at one landmark *manufactures* the next goal.
Naughty Dog's David Shaver (GDC 2018) adds the inverse: **temporarily removing a landmark from
view** motivates reacquiring it, and each reacquisition from a new angle reads as progress.

---

## 3. Curiosity loops, gravity, and instrumentation

**Nintendo's "gravity."** BotW's first pass distributed towers evenly with events between them.
Heatmaps showed **narrow funneled paths**; players "felt they were being guided, that the game was
too linear." The fix was **gravity** — structures of *varying visibility and varying importance*,
so different players are pulled in different directions and are allowed to be sidetracked. This
produced what they called **"infinite play"**. Objective order became player-dependent.

**The valley of boredom.** Burgess models interest as a curve between authored beats A and B:
interest wanes leaving A and falls into a valley. The fix is seeding X, Y, Z along the route —
and Bethesda literally **draws lines along quest routes and uses them to place POIs**. Critically:
**X and Y may be less interesting than A and B and that is fine.** Lower-amplitude beats still
shorten time in the valley.

**Density is a function of sightline length and blocker count, not taste.** *Fallout 3* reused
*Oblivion*'s density, but Fallout's long sightlines and absent visual blockers made it feel
"pushed together". In **alpha**, Bethesda took the entire environment art and level design teams
offline for **~2 months** to add map area. This is the direct precedent for Shapeland's risk.

**Budget world size from build cost, not the reverse.** Burgess's method: enumerate POI archetypes,
estimate build cost each, pick a **vertical chunk** (he uses a quarter-mile square as "the
immediate area surrounding the player"), populate it to target density, then multiply out to derive
how much world you can afford. Most open worlds start from a fixed world size and try to fill it.

**Consolation loot.** Every dead end, cliff bottom, and "you weren't supposed to come here" pocket
gets *something*. Players who go there are exploring, not failing; the alternative is "a middle
finger." Never put progression-critical content in a dead end.

**Instrumentation.** Ubisoft's DNA/DNA Viewer renders failure heatmaps over 2D maps *and* 3D world
geometry. Nintendo built a **"Game Over View"** showing where players died most, which motivated
adding autosaves. Both are cheap to replicate: log position at fixed intervals plus every death,
and render over the grid.

---

## 4. FromSoftware world structure

**Hub-and-loop topology.** From *Dark Souls Design Works*: Firelink Shrine was one of the **first**
areas designed. Miyazaki: "It's a small area but it connects to many different places and has many
hidden spots." Satake: "It was made to connect with areas in **every direction**." The payoff is
delivered via **one-way doors and elevators that only open from the far side**. Miyazaki's stated
preference is **verticality** — players should "climb" between areas with minimal loading breaks.

**Bonfire spacing is non-uniform and tightens with progress** — generous early, sparser later.
This converts checkpoint density into a difficulty curve without touching enemy stats.

**Open field vs legacy dungeon.** Elden Ring has **six maximum-scale legacy dungeons**. The
decisive asymmetry: **the open field has a world map; legacy dungeons deliberately have none**,
because they "emphasize the fun of exploring the unknown and learning to understand the structure
of the dungeons." Also: **fall damage is tuned low on purpose** so exploration is not stressful.

**Difficulty is the wayfinding signal.** Miyazaki: "I thought it would be fun for players to go
into the wrong stage and get brutally beaten up so badly that they would automatically know that
the stage was not the one to go at that point."

**The poison swamp as a deliberate pacing valley** — a stretch where traversal itself is the
antagonist and speed is taxed. Note the author's own verdict: "in the original *Elden Ring* I went
a little too far."

---

## 5. Kojima: terrain as obstacle

**Remove the abstractions that make movement free.** Kojima: "in any game, you could carry as many
items as you want... This time, if you're in the river, you can drift away." And: "even if games
are 'open-world,' there are limitations where you can't go further. Like, they created valleys
where you can't go. But in this game, you can go anywhere."

**Systems worth stealing.** A terrain scanner trichotomy — **blue = safe, yellow = slippery /
drains stamina, red = you will fall and lose cargo**; load *placement* affecting equilibrium;
route planning that surfaces **altitude change along the path**, not just distance; the map as an
active planning UI projecting markers into the world.

**If terrain costs the player, it must cost the AI.** Kojima Productions' Eric Johnson (GDC 2021)
described making NPCs *worse* at navigation to match players: raised navmesh step height plus
forward raycasts, ground-material checks giving NPCs a **random chance to slip on rock**, and
rocks painted as high-cost navigation areas so NPCs route *around* them. Otherwise the illusion
dies.

---

## 6. Shapeland's numbers

**Base conversion.** At `ROLL_DUR 0.19s`/cell, speed = **5.263 cells/s**.

| Beat interval | Fast roll (0.19s) | Careful (0.30s) |
|---|---|---|
| 3s (micro / input change) | **16 cells** | 10 |
| 10s (modern shipped density) | **53 cells** | 33 |
| 20s (observed mounted Witcher) | **105 cells** | 67 |
| 30s | **158 cells** | 100 |
| 40s (CDPR upper bound) | **211 cells** | 133 |
| 180s (macro beat) | **947 cells** | 600 |

### The nested budget (authoritative)

- **Every ~16 cells (3s):** something changes what the player is *doing* — a slope, gap, ledge, or
  one-cell height step. BotW's smallest triangle: tempo, not content.
- **Every ~50–105 cells (10–20s):** one piece of **visible life or motion** enters frame. CDPR's
  rule, retuned to observed shipped density.
- **Every ~150–210 cells (30–40s):** one **committable POI** — enterable, lootable, or fightable.
  Hard ceiling; never exceed 211 cells of nothing.
- **Every ~950 cells (3min):** a **named beat** — legacy-dungeon threshold, boss gate, or district
  transition.

### Landmark visibility bands

- **Tier 1 / beacon:** visible from **≥1,500 cells**. Target **3–6 in the whole world**. Silhouette
  must read at 1px of vertical detail.
- **Tier 2 / regional:** visible from **300–800 cells**. Target **~1 per district**. These are the
  occluders that hide Tier 3 objects.
- **Tier 3 / local:** visible from **60–200 cells**. The actual POI signs. **Chain them** — each
  should reveal exactly one previously-hidden Tier 3 landmark on arrival.
- **Occlusion budget:** **~50–70% of Tier 3 landmarks occluded at any moment.** Use cube and
  rectangular masses for *total* concealment (surprise), pyramidal and terraced masses for
  *gradual* reveal (anticipation). This is the highest-leverage geometry rule in the document.

### Density, anchored to Elden Ring

Elden Ring's playable area is **~13.5 km²** (*not* the widely-cited 79 km², which counts water and
non-navigable terrain). With **300+ Sites of Grace** and **38 in Limgrave** (~1.7 km²), that is
**~20–22 checkpoints per km²**, one per ~50,000 m², square spacing **√50,000 ≈ 224 m**. At 1m per
cell and 0.19s per cell, **224 cells = 42.6 seconds** — FromSoftware's shipped checkpoint spacing
independently lands on CD Projekt Red's number. Use it as the anchor:

- **Checkpoint spacing: ~200–230 cells, ~20 per km².** Tighten to **~120 cells** in the opening
  district, loosen toward **~350** in late/high-risk districts.
- **Committable POIs: ~60–100 per km²** (3–5× checkpoint density).
- **Consolation loot: 100% coverage of dead ends.** Zero exceptions, zero progression-critical
  items.
- **Districts:** sized so crossing takes **3–6 min (950–1,900 cells)**, each with a distinct cube
  palette, silhouette rule, and ambient bed.

### Two Shapeland-specific corrections

1. **Sightline calibration overrides density.** A grid world of hard-edged cubes with no foliage
   has very long sightlines and few natural blockers, so *Oblivion*-style density will feel
   cramped — the *Fallout 3* failure exactly. Either stretch spacing to the upper end of every
   band, or manufacture blockers (large cube massifs, terrace edges, fog volumes). **Measure this
   before locking world size, not in alpha.**
2. **Audio attractor rule.** Because occlusion is high, give every Tier 3 POI an audible emitter
   at **~1.5× its visual reveal radius** (~90–300 cells). Bethesda's accidental discovery is the
   most reliable cheap attractor in the literature.

---

## Sources

- Noclip, *Designing The World of The Witcher 3* — https://www.youtube.com/watch?v=oSS5T4od-GQ
- TweakTown on the 40-second rule — https://www.tweaktown.com/news/59420/witcher-3s-40-second-rule-kept-players-engaged/index.html
- ACM, *Exploration in Open-World Videogames: The Witcher 3* — https://dl.acm.org/doi/fullHtml/10.1145/3572921.3572926
- Uppsala thesis replicating the rule on *Genshin Impact* — https://uu.diva-portal.org/smash/get/diva2:1764361/FULLTEXT01.pdf
- Ashraf Ismail interview (30-second historical-accuracy rule) — https://www.pfangirl.com/gaming/assassins-creed-origins-full-interview-ashraf-ismail/
- *Half-Minute Halo: An Interview with Jaime Griesemer* — https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html
- Butcher & Griesemer, *The Illusion of Intelligence* (GDC 2002) — https://www.scribd.com/presentation/362869823/Halo-Gdc02-Jaime-Griesemer
- BotW CEDEC 2017 talks, translated — https://gist.github.com/idbrii/e39fe96279aa1670319bfa521d907399
- Original 4Gamer CEDEC coverage — https://www.4gamer.net/games/341/G034168/20170901120/
- Joel Burgess, GDC 2011, *Motivating Players in Open World Games* — http://blog.joelburgess.com/2011/03/gdc-2011-transcript-motivating-players.html
- Kevin Lynch, *The Image of the City* — https://en.wikipedia.org/wiki/The_Image_of_the_City
- Level Design Book, *Wayfinding* — https://book.leveldesignbook.com/process/blockout/wayfinding
- SMU Guildhall, *Composition Strategies to Motivate Player Exploration* — https://scholar.smu.edu/cgi/viewcontent.cgi?article=1015&context=guildhall_leveldesign_etds
- *Dark Souls Design Works* interview — https://darksouls.wiki.fextralife.com/Dark_Souls_1_-_Design_Works_Interview
- Miyazaki Elden Ring interview, part 2 — https://www.frontlinejp.net/2021/06/17/elden-ring-director-interview-part-2-miyazaki-discusses-the-gameplay/
- Game Informer, *Afterwords: Dark Souls* — https://gameinformer.com/b/features/archive/2011/11/12/afterwords-dark-souls.aspx
- Elden Ring true playable area (13.48 km²) — https://www.pcgamer.com/games/rpg/elden-ring-geographer-tests-rigorous-calculation-against-weed-fueled-horse-math-to-determine-the-exact-size-of-the-lands-between/
- Kojima interview, Game Informer 2019 — https://gameinformer.com/interview/2019/09/16/hideo-kojima-answers-our-questions-about-death-stranding
- *In Death Stranding, navigating the world was harder for NPCs than players* — https://www.gamedeveloper.com/programming/in-i-death-stranding-i-navigating-the-world-was-harder-for-npcs-than-players
- *Game Telemetry with DNA Tracking on Assassin's Creed* — https://www.gamedeveloper.com/design/game-telemetry-with-dna-tracking-on-assassin-s-creed
