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

export interface SimSnapshot {
  tick: number;
  seed: number;
  contentHash: number;
  integrity: number;
  player: PlayerSnapshot;
  move: MoveSnapshot;
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

export function createSnapshot(): SimSnapshot {
  return {
    tick: 0,
    seed: 0,
    contentHash: 0,
    integrity: 3,
    player: { x: 0, y: 0, z: 0, orientation: 0, faces: [0, 0, 0, 0, 0, 0], found: 0 },
    move: createMoveSnapshot(),
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
    a.hashes.player === b.hashes.player &&
    a.hashes.rng === b.hashes.rng &&
    a.hashes.world === b.hashes.world &&
    a.hashes.input === b.hashes.input &&
    a.hashes.total === b.hashes.total
  );
}
