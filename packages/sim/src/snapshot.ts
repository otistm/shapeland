import { FIRE_MAX, ICE_MAX, SCORCH_MAX, TURRET_COUNT } from "./constants";
import { HOSTILE_COUNT } from "./hostile-sites";

export interface LayeredHashes {
  player: number;
  rng: number;
  world: number;
  input: number;
  total: number;
}

export interface PlayerSnapshot {
  x: number;
  y: number;
  z: number;
  orientation: number;
  faces: number[];
  found: number;
}

export interface MoveSnapshot {
  mode: number;
  dir: number;
  phase: number;
  duration: number;
  startX: number;
  startY: number;
  startZ: number;
  startOri: number;
  destX: number;
  destY: number;
  destZ: number;
  destOri: number;
  leap: number;
  jumpBuf: number;
  pivotArmed: number;
  moveLock: number;
  flags: number;
  vy: number;
  airY: number;
}

export interface VfxSnapshot {
  burnT: number;
  burnDur: number;
  pulse: number;
  boltSeed: number;
  fireCount: number;
  scorchCount: number;
  scorchHash: number;
  iceCount: number;
  iceHash: number;
  groundH: number;
  fireX: Float32Array;
  fireY: Float32Array;
  fireZ: Float32Array;
  fireT: Float32Array;
  fireSize: Float32Array;
  fireStretch: Float32Array;
  fireA: Float32Array;
  fireSeed: Float32Array;
  scorch: Uint32Array;
  scorchH: Int8Array;
  ice: Uint32Array;
  iceH: Int8Array;
}

export interface WorldSliceSnapshot {
  sliceOn: number;
  stage: number;
  doorOpen: number;
  shrineTaken: number;
  glyphTaken: number;
  iceTaken: number;
  zigTaken: number;
  iframes: number;
  npcRange: number;
  banner: number;
  region: number;
  aiming: number;
  turretAlive: number;
  turretState: Uint8Array;
  turretT: Uint16Array;
  turretResist: Uint8Array;
  teleN: Uint8Array;
  teleX: Int8Array;
  teleZ: Int8Array;
  hostileAlive: Uint8Array;
  hostileKind: Uint8Array;
  hostileX: Int16Array;
  hostileZ: Int16Array;
  hostileState: Uint8Array;
  hostileT: Uint16Array;
  hostileResist: Uint8Array;
  hostileTeleN: Uint8Array;
  hostileTeleX: Int16Array;
  hostileTeleZ: Int16Array;
}

export interface SimSnapshot {
  tick: number;
  seed: number;
  contentHash: number;
  integrity: number;
  player: PlayerSnapshot;
  move: MoveSnapshot;
  vfx: VfxSnapshot;
  world: WorldSliceSnapshot;
  hashes: LayeredHashes;
}

export function createMoveSnapshot(): MoveSnapshot {
  return {
    mode: 0,
    dir: 0,
    phase: 0,
    duration: 0,
    startX: 0,
    startY: 0,
    startZ: 0,
    startOri: 0,
    destX: 0,
    destY: 0,
    destZ: 0,
    destOri: 0,
    leap: 0,
    jumpBuf: 0,
    pivotArmed: 0,
    moveLock: 0,
    flags: 0,
    vy: 0,
    airY: 0,
  };
}

export function createVfxSnapshot(): VfxSnapshot {
  return {
    burnT: 0,
    burnDur: 0,
    pulse: 0,
    boltSeed: 0,
    fireCount: 0,
    scorchCount: 0,
    scorchHash: 0,
    iceCount: 0,
    iceHash: 0,
    groundH: 0,
    fireX: new Float32Array(FIRE_MAX),
    fireY: new Float32Array(FIRE_MAX),
    fireZ: new Float32Array(FIRE_MAX),
    fireT: new Float32Array(FIRE_MAX),
    fireSize: new Float32Array(FIRE_MAX),
    fireStretch: new Float32Array(FIRE_MAX),
    fireA: new Float32Array(FIRE_MAX),
    fireSeed: new Float32Array(FIRE_MAX),
    scorch: new Uint32Array(SCORCH_MAX),
    scorchH: new Int8Array(SCORCH_MAX),
    ice: new Uint32Array(ICE_MAX),
    iceH: new Int8Array(ICE_MAX),
  };
}

export function createWorldSliceSnapshot(): WorldSliceSnapshot {
  return {
    sliceOn: 0,
    stage: 0,
    doorOpen: 1,
    shrineTaken: 0,
    glyphTaken: 0,
    iceTaken: 0,
    zigTaken: 0,
    iframes: 0,
    npcRange: 0,
    banner: 0,
    region: 0,
    aiming: 0,
    turretAlive: 0,
    turretState: new Uint8Array(TURRET_COUNT),
    turretT: new Uint16Array(TURRET_COUNT),
    turretResist: new Uint8Array(TURRET_COUNT),
    teleN: new Uint8Array(TURRET_COUNT),
    teleX: new Int8Array(TURRET_COUNT * 5),
    teleZ: new Int8Array(TURRET_COUNT * 5),
    hostileAlive: new Uint8Array(HOSTILE_COUNT),
    hostileKind: new Uint8Array(HOSTILE_COUNT),
    hostileX: new Int16Array(HOSTILE_COUNT),
    hostileZ: new Int16Array(HOSTILE_COUNT),
    hostileState: new Uint8Array(HOSTILE_COUNT),
    hostileT: new Uint16Array(HOSTILE_COUNT),
    hostileResist: new Uint8Array(HOSTILE_COUNT),
    hostileTeleN: new Uint8Array(HOSTILE_COUNT),
    hostileTeleX: new Int16Array(HOSTILE_COUNT * 5),
    hostileTeleZ: new Int16Array(HOSTILE_COUNT * 5),
  };
}

export function createSnapshot(): SimSnapshot {
  return {
    tick: 0,
    seed: 0,
    contentHash: 0,
    integrity: 3,
    player: { x: 0, y: 0, z: 0, orientation: 0, faces: [0, 0, 0, 0, 0, 0], found: 0 },
    move: createMoveSnapshot(),
    vfx: createVfxSnapshot(),
    world: createWorldSliceSnapshot(),
    hashes: { player: 0, rng: 0, world: 0, input: 0, total: 0 },
  };
}

export function copyMove(src: MoveSnapshot, dest: MoveSnapshot): void {
  dest.mode = src.mode;
  dest.dir = src.dir;
  dest.phase = src.phase;
  dest.duration = src.duration;
  dest.startX = src.startX;
  dest.startY = src.startY;
  dest.startZ = src.startZ;
  dest.startOri = src.startOri;
  dest.destX = src.destX;
  dest.destY = src.destY;
  dest.destZ = src.destZ;
  dest.destOri = src.destOri;
  dest.leap = src.leap;
  dest.jumpBuf = src.jumpBuf;
  dest.pivotArmed = src.pivotArmed;
  dest.moveLock = src.moveLock;
  dest.flags = src.flags;
  dest.vy = src.vy;
  dest.airY = src.airY;
}

function copyN(src: Float32Array, dest: Float32Array, n: number): void {
  for (let i = 0; i < n; i++) dest[i] = src[i] ?? 0;
}

export function copyVfx(src: VfxSnapshot, dest: VfxSnapshot): void {
  dest.burnT = src.burnT;
  dest.burnDur = src.burnDur;
  dest.pulse = src.pulse;
  dest.boltSeed = src.boltSeed;
  dest.fireCount = src.fireCount;
  dest.scorchCount = src.scorchCount;
  dest.scorchHash = src.scorchHash;
  dest.iceCount = src.iceCount;
  dest.iceHash = src.iceHash;
  dest.groundH = src.groundH;
  copyN(src.fireX, dest.fireX, src.fireCount);
  copyN(src.fireY, dest.fireY, src.fireCount);
  copyN(src.fireZ, dest.fireZ, src.fireCount);
  copyN(src.fireT, dest.fireT, src.fireCount);
  copyN(src.fireSize, dest.fireSize, src.fireCount);
  copyN(src.fireStretch, dest.fireStretch, src.fireCount);
  copyN(src.fireA, dest.fireA, src.fireCount);
  copyN(src.fireSeed, dest.fireSeed, src.fireCount);
  for (let i = 0; i < src.scorchCount; i++) {
    dest.scorch[i] = src.scorch[i] ?? 0;
    dest.scorchH[i] = src.scorchH[i] ?? 0;
  }
  for (let i = 0; i < src.iceCount; i++) {
    dest.ice[i] = src.ice[i] ?? 0;
    dest.iceH[i] = src.iceH[i] ?? 0;
  }
}

function floatsEqual(a: Float32Array, b: Float32Array, n: number): boolean {
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function vfxEqual(a: VfxSnapshot, b: VfxSnapshot): boolean {
  if (
    a.burnT !== b.burnT ||
    a.burnDur !== b.burnDur ||
    a.pulse !== b.pulse ||
    a.boltSeed !== b.boltSeed ||
    a.fireCount !== b.fireCount ||
    a.scorchCount !== b.scorchCount ||
    a.scorchHash !== b.scorchHash ||
    a.iceCount !== b.iceCount ||
    a.iceHash !== b.iceHash ||
    a.groundH !== b.groundH
  ) {
    return false;
  }
  if (!floatsEqual(a.fireX, b.fireX, a.fireCount)) return false;
  if (!floatsEqual(a.fireY, b.fireY, a.fireCount)) return false;
  if (!floatsEqual(a.fireZ, b.fireZ, a.fireCount)) return false;
  if (!floatsEqual(a.fireT, b.fireT, a.fireCount)) return false;
  for (let i = 0; i < a.scorchCount; i++) {
    if (a.scorch[i] !== b.scorch[i] || a.scorchH[i] !== b.scorchH[i]) return false;
  }
  for (let i = 0; i < a.iceCount; i++) {
    if (a.ice[i] !== b.ice[i] || a.iceH[i] !== b.iceH[i]) return false;
  }
  return true;
}

export function copyWorldSlice(src: WorldSliceSnapshot, dest: WorldSliceSnapshot): void {
  dest.sliceOn = src.sliceOn;
  dest.stage = src.stage;
  dest.doorOpen = src.doorOpen;
  dest.shrineTaken = src.shrineTaken;
  dest.glyphTaken = src.glyphTaken;
  dest.iceTaken = src.iceTaken;
  dest.zigTaken = src.zigTaken;
  dest.iframes = src.iframes;
  dest.npcRange = src.npcRange;
  dest.banner = src.banner;
  dest.region = src.region;
  dest.aiming = src.aiming;
  dest.turretAlive = src.turretAlive;
  dest.turretState.set(src.turretState);
  dest.turretT.set(src.turretT);
  dest.turretResist.set(src.turretResist);
  dest.teleN.set(src.teleN);
  dest.teleX.set(src.teleX);
  dest.teleZ.set(src.teleZ);
  dest.hostileAlive.set(src.hostileAlive);
  dest.hostileKind.set(src.hostileKind);
  dest.hostileX.set(src.hostileX);
  dest.hostileZ.set(src.hostileZ);
  dest.hostileState.set(src.hostileState);
  dest.hostileT.set(src.hostileT);
  dest.hostileResist.set(src.hostileResist);
  dest.hostileTeleN.set(src.hostileTeleN);
  dest.hostileTeleX.set(src.hostileTeleX);
  dest.hostileTeleZ.set(src.hostileTeleZ);
}

export function copySnapshot(src: SimSnapshot, dest: SimSnapshot): void {
  dest.tick = src.tick;
  dest.seed = src.seed;
  dest.contentHash = src.contentHash;
  dest.integrity = src.integrity;
  dest.player.x = src.player.x;
  dest.player.y = src.player.y;
  dest.player.z = src.player.z;
  dest.player.orientation = src.player.orientation;
  dest.player.found = src.player.found;
  for (let i = 0; i < 6; i++) dest.player.faces[i] = src.player.faces[i] ?? 0;
  copyMove(src.move, dest.move);
  copyVfx(src.vfx, dest.vfx);
  copyWorldSlice(src.world, dest.world);
  dest.hashes.player = src.hashes.player;
  dest.hashes.rng = src.hashes.rng;
  dest.hashes.world = src.hashes.world;
  dest.hashes.input = src.hashes.input;
  dest.hashes.total = src.hashes.total;
}

export function snapshotsEqual(a: SimSnapshot, b: SimSnapshot): boolean {
  return (
    a.tick === b.tick &&
    a.seed === b.seed &&
    a.contentHash === b.contentHash &&
    a.integrity === b.integrity &&
    a.player.x === b.player.x &&
    a.player.y === b.player.y &&
    a.player.z === b.player.z &&
    a.player.orientation === b.player.orientation &&
    a.player.found === b.player.found &&
    a.player.faces[0] === b.player.faces[0] &&
    a.player.faces[1] === b.player.faces[1] &&
    a.player.faces[2] === b.player.faces[2] &&
    a.player.faces[3] === b.player.faces[3] &&
    a.player.faces[4] === b.player.faces[4] &&
    a.player.faces[5] === b.player.faces[5] &&
    a.move.mode === b.move.mode &&
    a.move.dir === b.move.dir &&
    a.move.phase === b.move.phase &&
    a.move.duration === b.move.duration &&
    a.move.startX === b.move.startX &&
    a.move.startY === b.move.startY &&
    a.move.startZ === b.move.startZ &&
    a.move.startOri === b.move.startOri &&
    a.move.destX === b.move.destX &&
    a.move.destY === b.move.destY &&
    a.move.destZ === b.move.destZ &&
    a.move.destOri === b.move.destOri &&
    a.move.leap === b.move.leap &&
    a.move.jumpBuf === b.move.jumpBuf &&
    a.move.pivotArmed === b.move.pivotArmed &&
    a.move.moveLock === b.move.moveLock &&
    a.move.flags === b.move.flags &&
    a.move.vy === b.move.vy &&
    a.move.airY === b.move.airY &&
    vfxEqual(a.vfx, b.vfx) &&
    a.world.sliceOn === b.world.sliceOn &&
    a.world.stage === b.world.stage &&
    a.world.doorOpen === b.world.doorOpen &&
    a.world.shrineTaken === b.world.shrineTaken &&
    a.world.glyphTaken === b.world.glyphTaken &&
    a.world.iceTaken === b.world.iceTaken &&
    a.world.zigTaken === b.world.zigTaken &&
    a.world.iframes === b.world.iframes &&
    a.world.npcRange === b.world.npcRange &&
    a.world.banner === b.world.banner &&
    a.world.region === b.world.region &&
    a.world.aiming === b.world.aiming &&
    a.world.turretAlive === b.world.turretAlive &&
    a.hashes.player === b.hashes.player &&
    a.hashes.rng === b.hashes.rng &&
    a.hashes.world === b.hashes.world &&
    a.hashes.input === b.hashes.input &&
    a.hashes.total === b.hashes.total
  );
}
