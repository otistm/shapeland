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
}

export interface SimSnapshot {
  tick: number;
  seed: number;
  contentHash: number;
  integrity: number;
  player: PlayerSnapshot;
  hashes: LayeredHashes;
}

export function createSnapshot(): SimSnapshot {
  return {
    tick: 0,
    seed: 0,
    contentHash: 0,
    integrity: 3,
    player: { x: 0, y: 0, z: 0, orientation: 0 },
    hashes: { player: 0, rng: 0, world: 0, input: 0, total: 0 },
  };
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
    a.hashes.player === b.hashes.player &&
    a.hashes.rng === b.hashes.rng &&
    a.hashes.world === b.hashes.world &&
    a.hashes.input === b.hashes.input &&
    a.hashes.total === b.hashes.total
  );
}
