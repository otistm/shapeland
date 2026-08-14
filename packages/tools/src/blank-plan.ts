/**
 * The authored plan for THE BLANK.
 *
 * Landmarks first, filler second — the level-design order. Noise never decides where a named place
 * is; it only dresses the ground between them. Every district is anchored to a real landform, and
 * the real measurements are recorded next to it so a later edit can be checked against the source
 * rather than against taste.
 *
 * Scale: 1 cell ≈ 2 m, so a 1-unit step ≈ 2 m — which is, conveniently, both the average Ifugao
 * retaining wall and the lower end of a Pamukkale pool rim.
 *
 * Drainage is the thing that makes it cohere: the water source is the high north-west plateau, it
 * cascades south-east through terraced pools, crosses a limestone pavement, and spreads into a delta
 * in the south. That gives the whole map one consistent vertical direction — "downhill is
 * south-east" — which is the directional-legibility rule.
 */

import type { StructureSite } from "@shapeland/sim";

export type { StructureSite };

/** POI cadence ceiling in cells, from the pacing table. A longer commit than this is a dead stretch. */
export const POI_CEILING = 211;

export interface BenchSite {
  readonly cx: number;
  readonly cz: number;
  readonly halfW: number;
  readonly halfD: number;
  readonly top: number;
  readonly tread: number;
}

export interface PoolSite {
  readonly cx: number;
  readonly cz: number;
  readonly halfW: number;
  readonly halfD: number;
  readonly rimTop: number;
  readonly steps: number;
}

/** A committable point of interest. `ref` is the real place it is measured from. */
export interface Poi {
  readonly name: string;
  readonly x: number;
  readonly z: number;
  readonly ref: string;
}

export interface District {
  readonly name: string;
  readonly ref: string;
  readonly benches: readonly BenchSite[];
  readonly pools: readonly PoolSite[];
  readonly pois: readonly Poi[];
  readonly structures?: readonly StructureSite[];
}

function bench(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  top: number,
  tread = 1,
): BenchSite {
  return { cx, cz, halfW, halfD, top, tread };
}

function pool(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rimTop: number,
  steps: number,
): PoolSite {
  return { cx, cz, halfW, halfD, rimTop, steps };
}

/**
 * Pamukkale, Türkiye. The plateau has two levels about 30 m apart with the ancient city on the
 * upper one; terrace-mound pools mantle the slope between them, with individual steps from under a
 * metre to six. Seventeen hot springs sit on the flat top and the water runs off the rim. Separate
 * fissure ridges run 100–1500 m long and rise up to 25 m above the lower level.
 *
 * Here: an upper plateau at 8, a cascade of pools stepping 7→3 down the slope to the south-east,
 * and two fissure ridges as long thin benches. This is the water source for the whole map.
 */
const COTTON_CASTLE: District = {
  name: "THE COTTON CASTLE",
  ref: "Pamukkale travertines, Türkiye",
  benches: [bench(-118, -120, 12, 8, 8), bench(-142, -84, 10, 1, 5), bench(-120, -58, 13, 1, 4)],
  pools: [
    pool(-122, -124, 5, 3, 8, 3),
    pool(-104, -96, 6, 5, 7, 2),
    pool(-88, -76, 7, 5, 6, 2),
    pool(-72, -58, 7, 5, 5, 2),
    pool(-58, -42, 6, 4, 4, 2),
    pool(-56, -26, 6, 4, 3, 1),
  ],
  pois: [
    { name: "THE COTTON CASTLE", x: -118, z: -120, ref: "Pamukkale upper plateau" },
    { name: "THE SPILL", x: -88, z: -76, ref: "Pamukkale terrace-mound pools" },
    { name: "THE FISSURE", x: -142, z: -84, ref: "Pamukkale fissure ridge" },
  ],
  structures: [{ kind: "salk_court", cx: -118, cz: -120 }],
};

/**
 * Goosenecks of the San Juan, Utah — the meander belt west of Monument Valley. A low saddle so the
 * hop from Cotton Castle to West Mitten is a choice with a rest, not a 208-cell corridor.
 */
const THE_GOOSENECKS: District = {
  name: "THE GOOSENECKS",
  ref: "Goosenecks of the San Juan, Utah",
  benches: [bench(-15, -118, 2, 2, 3)],
  pools: [],
  pois: [{ name: "THE GOOSENECKS", x: -15, z: -118, ref: "Goosenecks of the San Juan, Utah" }],
};

/**
 * Monument Valley, Arizona/Utah. Buttes rise up to 1,000 ft above the valley floor, capped by
 * resistant sandstone over softer shale; as the cliff edges retreat the debris piles into gentle
 * talus aprons at the base. West and East Mitten are a matched pair with Merrick Butte beside them,
 * and a butte is taller than it is wide while a mesa is broader and lower.
 *
 * The talus apron is exactly our staircase skirt, so this district is the grammar's best argument:
 * the reason a height-8 form is 19 cells across is the same reason a real butte has a scree slope.
 */
const THE_MITTENS: District = {
  name: "THE MITTENS",
  ref: "Monument Valley, Arizona/Utah",
  benches: [
    bench(88, -118, 2, 2, 8),
    bench(120, -104, 2, 2, 8),
    bench(104, -142, 1, 1, 6),
    bench(140, -140, 8, 5, 7),
    bench(64, -86, 1, 1, 5),
    // East stair: a return ridge from the Mittens south toward the Grikes, so the north is a loop.
    bench(112, -72, 1, 8, 4),
    bench(106, -50, 1, 4, 2),
  ],
  pools: [],
  pois: [
    { name: "WEST MITTEN", x: 88, z: -118, ref: "West Mitten Butte" },
    { name: "EAST MITTEN", x: 120, z: -104, ref: "East Mitten Butte" },
    { name: "THE SENTINEL", x: 140, z: -140, ref: "Sentinel Mesa" },
    { name: "THE EAST STAIR", x: 112, z: -72, ref: "Valley of the Gods approach, Utah" },
  ],
  structures: [{ kind: "habitat", cx: 140, cz: -140 }],
};

/**
 * Two keeps flanking the approach to the gauntlet. 21u Boston City Hall massing: you walk *into*
 * a sentinel (3×3 court, public door facing the axis) and *through* the 72-cell prospect between
 * them. Staging, not a climb — the old height-7 benches were a landform wearing a building's name.
 */
const THE_WATCHERS: District = {
  name: "THE WATCHERS",
  ref: "Boston City Hall paired keeps / Monument Valley sentinels",
  benches: [bench(-48, -8, 0, 0, 2)],
  pools: [],
  // Labelled from the chasm rim, which is where both silhouettes line up — not from between them,
  // because that ground is inside the sealed gauntlet.
  pois: [
    { name: "THE WATCHERS", x: 0, z: -9, ref: "paired sentinel keeps" },
    { name: "THE WEST FLANK", x: -48, z: -8, ref: "Monument Valley west approach" },
  ],
  structures: [
    { kind: "pylon_keep", cx: -36, cz: -22 },
    { kind: "pylon_keep", cx: 36, cz: -22 },
  ],
};

/**
 * Banaue / Ifugao rice terraces, Philippines. Contour benches with dry-stone retaining walls
 * averaging about 2 m and reaching 5–6 m; paddy widths usually 6–7 m and narrowing to under 2 m on
 * the steepest ground; lower terraces wider than upper ones; forest kept on the ridge above.
 *
 * A 2 m wall is one unit and a 6 m paddy is three cells, so this is `tread: 3` — the processional
 * 1:3 slope. Grass lands on the treads, which is the forest-and-paddy read.
 */
const IFUGAO_STEPS: District = {
  name: "THE IFUGAO STEPS",
  ref: "Banaue rice terraces, Philippines",
  benches: [bench(-112, 26, 9, 6, 8, 3), bench(-118, 100, 12, 8, 5, 3)],
  pools: [],
  pois: [
    { name: "THE IFUGAO STEPS", x: -112, z: 26, ref: "Banaue contour terraces" },
    { name: "THE LOWER PADDIES", x: -118, z: 100, ref: "Maligcong lower terraces" },
  ],
};

/**
 * The Burren, Ireland. Limestone pavement of blocks called clints separated by fissures called
 * grikes; most clints are 0.4–2.8 m² though they reach 65 m², and grikes are usually under 2 m deep
 * with a dominant north–south system and a weaker east–west one at right angles.
 *
 * Clints become 1-high benches and grikes become the 1-cell channels between them. A minority of
 * grike cells open into true gaps — the required gap for a leap is exactly 1 cell — so the pavement
 * rolls everywhere and leaps are shortcuts rather than tolls. The N–S runs are continuous and the
 * E–W ones are broken, which is what makes the field readable as grain rather than as a checkerboard.
 */
const THE_GRIKES: District = {
  name: "THE GRIKES",
  ref: "Burren limestone pavement, Ireland",
  benches: [],
  pools: [],
  pois: [
    { name: "THE GRIKES", x: 100, z: -8, ref: "Burren clint-and-grike pavement" },
    { name: "THE SHATTERED PAVEMENT", x: 128, z: 32, ref: "east Burren shattered pavement" },
  ],
};

/**
 * Three named knolls in the waste between landmarks. Authored benches, not noise hills: a filler
 * peak that earns a title has to be a place you can point at, not a hash that moved.
 *
 * THE COMB sits on the Cotton Castle → Mittens corridor (Comb Ridge), west of the Mittens so
 * West Mitten still pairs with Sentinel in the greedy tour. SILBURY is the west waste between
 * Ifugao and the Ziggurat — z=70, not 56, so the Ifugao apron (z ≤ 53) stays a terrace rather
 * than a merged mound. THE PAP is the east saddle between Grikes (z1=44) and Causeway (z0=74).
 */
const THE_KNOLLS: District = {
  name: "THE KNOLLS",
  ref: "named filler between landmarks",
  benches: [bench(24, -132, 0, 0, 5), bench(-84, 70, 0, 0, 4), bench(112, 56, 0, 0, 4)],
  pools: [],
  pois: [
    { name: "THE COMB", x: 24, z: -132, ref: "Comb Ridge, Utah" },
    { name: "SILBURY", x: -84, z: 70, ref: "Silbury Hill, Wiltshire" },
    { name: "THE PAP", x: 112, z: 56, ref: "Pap of Glencoe, Scotland" },
  ],
};

/**
 * Great Ziggurat of Ur, Iraq. A rectangular stepped platform about 64 × 46 m at the base in three
 * tiers, fronted by a monumental stair. At 1 cell ≈ 2 m that base is roughly 32 × 23 cells, which
 * is the 29 × 19 core below; `tread: 2` is the grand 1:2 stair.
 *
 * The one piece of deliberate architecture in a map of landforms, so it reads as made rather than
 * found — sealing authority is the stepped pyramid. The 1:2 plinth stays a landform you climb;
 * the 21u Kahn ring on the summit is a building you enter (monumental south gate, north closed).
 */
const THE_ZIGGURAT: District = {
  name: "THE ZIGGURAT",
  ref: "Great Ziggurat of Ur + Jatiya Sangsad Bhaban, Dhaka",
  benches: [bench(-56, 120, 14, 9, 8, 2)],
  pools: [],
  pois: [{ name: "THE ZIGGURAT", x: -56, z: 120, ref: "Great Ziggurat of Ur / Kahn assembly" }],
  structures: [{ kind: "assembly", cx: -56, cz: 120 }],
};

/**
 * Okavango Delta, Botswana. A braided inland delta of distributary channels, seasonal swamp and
 * sand islands — the place the water finally stops. Low ground: islands at 1, channels of water,
 * swamp at the margins, grass on the island crowns.
 */
const THE_DELTA: District = {
  name: "THE DELTA",
  ref: "Okavango Delta, Botswana",
  benches: [
    bench(-8, 96, 4, 3, 1),
    bench(22, 116, 5, 2, 1),
    bench(52, 100, 3, 3, 2),
    bench(10, 142, 6, 3, 1),
    bench(-26, 132, 3, 2, 1),
  ],
  pools: [pool(30, 84, 6, 4, 2, 1), pool(-2, 124, 7, 4, 2, 1)],
  pois: [
    { name: "THE DELTA", x: 10, z: 110, ref: "Okavango distributaries" },
    { name: "THE SAND ISLANDS", x: 52, z: 100, ref: "Okavango sand islands" },
  ],
};

/**
 * Giant's Causeway, Northern Ireland. Some forty thousand interlocking basalt columns with flat
 * polygonal tops, stepping down into the sea.
 *
 * Columns become a dense field of 1- and 2-cell benches at heights 1–4 whose neighbours stay within
 * one unit, so the whole thing is a rolling staircase rather than a wall — and it steps down toward
 * the delta water in the south-east, which is where the map's drainage ends.
 */
const THE_CAUSEWAY: District = {
  name: "THE CAUSEWAY",
  ref: "Giant's Causeway, Northern Ireland",
  benches: [],
  pools: [],
  pois: [
    { name: "THE CAUSEWAY", x: 120, z: 104, ref: "Giant's Causeway columns" },
    // East foot, not the far SE corner: (148, 136) is farther from Causeway than THE PAP, so the
    // greedy tour left Shore and Sentinel as opposite-corner leftovers over the 211 ceiling.
    { name: "THE SHORE", x: 148, z: 128, ref: "Giant's Causeway seaward foot" },
  ],
  structures: [{ kind: "hypostyle", cx: 120, cz: 104 }],
};

export const BLANK_PLAN: readonly District[] = [
  COTTON_CASTLE,
  THE_GOOSENECKS,
  THE_MITTENS,
  THE_WATCHERS,
  IFUGAO_STEPS,
  THE_GRIKES,
  THE_KNOLLS,
  THE_ZIGGURAT,
  THE_DELTA,
  THE_CAUSEWAY,
];

/** Limestone pavement field. Generated rather than listed: it is thousands of small blocks. */
export const GRIKE_FIELD = { x0: 62, z0: -44, x1: 142, z1: 44, clint: 3, course: 6 } as const;

/**
 * Authored N–S grikes. Clint step is 4, so channels sit at x = 65, 69, 73, … — these three are
 * channels. `gapOk` spacing 1 forbids a continuous canyon; the generator stamps these first with
 * Z-adjacent gaps allowed so the grain is a path you can commit to, not confetti.
 */
export const GRIKE_CANYONS = [
  { x: 81, z0: -40, z1: 36 },
  { x: 105, z0: -40, z1: 36 },
  { x: 129, z0: -40, z1: 36 },
] as const;

/** Columnar field. Heights step down toward the south-east corner. */
export const CAUSEWAY_FIELD = { x0: 96, z0: 74, x1: 150, z1: 140 } as const;

/** Braided channels: the delta's water is authored as courses, not as round puddles. */
export const DELTA_FIELD = { x0: -40, z0: 62, x1: 92, z1: 156 } as const;

export function planBenches(): BenchSite[] {
  const out: BenchSite[] = [];
  for (const d of BLANK_PLAN) out.push(...d.benches);
  return out;
}

export function planPools(): PoolSite[] {
  const out: PoolSite[] = [];
  for (const d of BLANK_PLAN) out.push(...d.pools);
  return out;
}

export function planPois(): Poi[] {
  const out: Poi[] = [];
  for (const d of BLANK_PLAN) out.push(...d.pois);
  return out;
}

export function planStructures(): StructureSite[] {
  const out: StructureSite[] = [];
  for (const d of BLANK_PLAN) {
    if (d.structures) out.push(...d.structures);
  }
  return out;
}
