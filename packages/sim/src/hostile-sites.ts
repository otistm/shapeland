/**
 * Authored Blank hostiles. Variety is grammar, not HP: cones watch, tetras lurch.
 * Opening air around START is empty so the first cone is a choice, not a spawn trap.
 */
export const HOSTILE_CONE_SCOUT = 0;
export const HOSTILE_CONE_WATCH = 1;
export const HOSTILE_CONE_SPIRE = 2;
export const HOSTILE_TETRA = 3;

export type HostileKind =
  | typeof HOSTILE_CONE_SCOUT
  | typeof HOSTILE_CONE_WATCH
  | typeof HOSTILE_CONE_SPIRE
  | typeof HOSTILE_TETRA;

export type HostileSite = readonly [kind: HostileKind, x: number, z: number];

export const HOSTILE_SITES: readonly HostileSite[] = [
  [HOSTILE_CONE_SCOUT, 28, 8],
  [HOSTILE_CONE_SCOUT, -40, -80],
  [HOSTILE_CONE_SCOUT, -72, -40],
  [HOSTILE_CONE_SCOUT, -96, -88],
  [HOSTILE_CONE_SCOUT, -90, 40],
  [HOSTILE_CONE_SCOUT, -100, 80],
  [HOSTILE_CONE_SCOUT, 24, -118],
  [HOSTILE_CONE_SCOUT, -70, 56],
  [HOSTILE_CONE_SCOUT, 10, 88],
  [HOSTILE_CONE_SCOUT, 44, 124],
  [HOSTILE_CONE_SCOUT, 50, -50],
  [HOSTILE_CONE_SCOUT, 140, 40],
  [HOSTILE_CONE_SCOUT, -140, 20],
  [HOSTILE_CONE_SCOUT, 6, 52],
  [HOSTILE_CONE_SCOUT, -80, -140],
  [HOSTILE_CONE_SCOUT, 90, 148],
  [HOSTILE_CONE_SCOUT, -130, 128],
  [HOSTILE_CONE_WATCH, 100, -90],
  [HOSTILE_CONE_WATCH, -64, -48],
  [HOSTILE_CONE_WATCH, 56, -40],
  [HOSTILE_CONE_WATCH, -32, 88],
  [HOSTILE_CONE_WATCH, 122, -122],
  [HOSTILE_CONE_WATCH, 16, -96],
  [HOSTILE_CONE_SPIRE, -20, 70],
  [HOSTILE_CONE_SPIRE, 80, 40],
  [HOSTILE_TETRA, 72, -100],
  [HOSTILE_TETRA, 88, 16],
  [HOSTILE_TETRA, 146, 82],
  [HOSTILE_TETRA, -20, 140],
  [HOSTILE_TETRA, 60, 70],
];

export const HOSTILE_COUNT = HOSTILE_SITES.length;
