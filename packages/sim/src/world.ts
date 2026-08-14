import { ICE_MAX, INTEGRITY, SCORCH_MAX, TURRET_COUNT } from "./constants";
import { FireField } from "./fire";
import { fnv1aF64, fnv1aI32, fnv1aStart, fnv1aU8, fnv1aU32 } from "./hash";
import { FACE_COUNT, facesLegal, grantAbility } from "./loadout";
import { stepMovement } from "./movement";
import { assertOrientationTables } from "./orientation";
import { type RngBank, copyRngBank, createRngBank, sfc32Next } from "./rng";
import { bootSlice, occupied as occupiedCell, stepSlice } from "./slice";
import { type SimSnapshot, createSnapshot } from "./snapshot";
import { Terrain } from "./terrain";
import { copyFireLive, hashFire, stepVfx } from "./vfx";

export interface WorldConfig {
  seed: number;
  contentHash: number;
  terrain?: Terrain;
  slice?: boolean;
}

export class World {
  tick = 0;
  readonly seed: number;
  readonly contentHash: number;
  readonly player = new Int32Array(4);
  buttonMask = 0;
  integrity = INTEGRITY;
  readonly rng: RngBank;
  readonly terrain: Terrain;

  x = 0;
  h = 0;
  z = 0;
  orientation = 0;
  mode = 0;
  dir = 0;
  phase = 0;
  duration = 0;
  startX = 0;
  startH = 0;
  startZ = 0;
  startOri = 0;
  destX = 0;
  destH = 0;
  destZ = 0;
  destOri = 0;
  leap = 0;
  jumpBuf = 0;
  pivotArmed = 0;
  moveLock = 0;
  flags = 0;
  vy = 0;
  airY = 0;
  prevMask = 0;
  spawnX = 0;
  spawnH = 0;
  spawnZ = 0;
  spawnOri = 0;
  readonly faces = new Uint8Array(FACE_COUNT);
  found = 0;
  burnT = 0;
  burnDur = 0;
  vfxPulse = 0;
  boltSeed = 0;
  readonly fire = new FireField();
  readonly scorch = new Uint32Array(SCORCH_MAX);
  readonly scorchH = new Int8Array(SCORCH_MAX);
  scorchCount = 0;
  scorchHash = 0;
  readonly ice = new Uint32Array(ICE_MAX);
  readonly iceH = new Int8Array(ICE_MAX);
  iceCount = 0;
  iceHash = 0;

  sliceOn = 0;
  stage = 0;
  doorOpen = 1;
  shrineTaken = 0;
  glyphTaken = 0;
  iceTaken = 0;
  zigTaken = 0;
  iframes = 0;
  npcRange = 0;
  banner = 0;
  region = 0;
  announced = 0;
  npcOn = 0;
  aiming = 0;
  turretAlive = 0;
  readonly turretX = new Int8Array(TURRET_COUNT);
  readonly turretZ = new Int8Array(TURRET_COUNT);
  readonly turretState = new Uint8Array(TURRET_COUNT);
  readonly turretT = new Uint16Array(TURRET_COUNT);
  readonly turretResist = new Uint8Array(TURRET_COUNT);
  readonly teleN = new Uint8Array(TURRET_COUNT);
  readonly teleX = new Int8Array(TURRET_COUNT * 5);
  readonly teleZ = new Int8Array(TURRET_COUNT * 5);

  constructor(config: WorldConfig) {
    assertOrientationTables();
    this.seed = config.seed >>> 0;
    this.contentHash = config.contentHash >>> 0;
    this.rng = createRngBank(this.seed);
    this.terrain = config.terrain ?? new Terrain();
    if (config.slice) bootSlice(this);
  }

  occupied(x: number, z: number): boolean {
    return occupiedCell(this, x, z);
  }

  step(mask: number): void {
    this.tick += 1;
    this.buttonMask = mask | 0;
    stepMovement(this, mask | 0);
    stepVfx(this);
    stepSlice(this);
    sfc32Next(this.rng.world);
  }

  capture(out: SimSnapshot): void {
    this.player[0] = this.x;
    this.player[1] = this.h;
    this.player[2] = this.z;
    this.player[3] = this.orientation;
    out.tick = this.tick;
    out.seed = this.seed;
    out.contentHash = this.contentHash;
    out.integrity = this.integrity;
    out.player.x = this.x;
    out.player.y = this.h;
    out.player.z = this.z;
    out.player.orientation = this.orientation;
    out.player.found = this.found;
    for (let i = 0; i < FACE_COUNT; i++) out.player.faces[i] = this.faces[i] ?? 0;
    out.move.mode = this.mode;
    out.move.dir = this.dir;
    out.move.phase = this.phase;
    out.move.duration = this.duration;
    out.move.startX = this.startX;
    out.move.startY = this.startH;
    out.move.startZ = this.startZ;
    out.move.startOri = this.startOri;
    out.move.destX = this.destX;
    out.move.destY = this.destH;
    out.move.destZ = this.destZ;
    out.move.destOri = this.destOri;
    out.move.leap = this.leap;
    out.move.jumpBuf = this.jumpBuf;
    out.move.pivotArmed = this.pivotArmed;
    out.move.moveLock = this.moveLock;
    out.move.flags = this.flags;
    out.move.vy = this.vy;
    out.move.airY = this.airY;
    const v = out.vfx;
    v.burnT = this.burnT;
    v.burnDur = this.burnDur;
    v.pulse = this.vfxPulse;
    v.boltSeed = this.boltSeed;
    v.groundH = this.h;
    v.scorchCount = this.scorchCount;
    v.scorchHash = this.scorchHash;
    v.iceCount = this.iceCount;
    v.iceHash = this.iceHash;
    for (let i = 0; i < this.scorchCount; i++) {
      v.scorch[i] = this.scorch[i] ?? 0;
      v.scorchH[i] = this.scorchH[i] ?? 0;
    }
    for (let i = 0; i < this.iceCount; i++) {
      v.ice[i] = this.ice[i] ?? 0;
      v.iceH[i] = this.iceH[i] ?? 0;
    }
    v.fireCount = copyFireLive(
      this.fire,
      v.fireX,
      v.fireY,
      v.fireZ,
      v.fireT,
      v.fireSize,
      v.fireStretch,
      v.fireA,
      v.fireSeed,
    );
    const w = out.world;
    w.sliceOn = this.sliceOn;
    w.stage = this.stage;
    w.doorOpen = this.doorOpen;
    w.shrineTaken = this.shrineTaken;
    w.glyphTaken = this.glyphTaken;
    w.iceTaken = this.iceTaken;
    w.zigTaken = this.zigTaken;
    w.iframes = this.iframes;
    w.npcRange = this.npcRange;
    w.banner = this.banner;
    w.region = this.region;
    w.aiming = this.aiming;
    w.turretAlive = this.turretAlive;
    w.turretState.set(this.turretState);
    w.turretT.set(this.turretT);
    w.turretResist.set(this.turretResist);
    w.teleN.set(this.teleN);
    w.teleX.set(this.teleX);
    w.teleZ.set(this.teleZ);
    out.hashes.player = hashPlayer(out);
    out.hashes.rng = hashRng(this.rng);
    out.hashes.world = hashWorld(this.contentHash, this.tick, out, hashFire(this.fire));
    out.hashes.input = fnv1aU32(fnv1aStart(), this.buttonMask);
    out.hashes.total = combineLayers(out.hashes);
  }

  snapshot(): SimSnapshot {
    const out = createSnapshot();
    this.capture(out);
    return out;
  }

  cloneRng(): RngBank {
    return copyRngBank(this.rng);
  }

  grant(ability: number): void {
    this.found = grantAbility(this.found, ability);
  }

  /** Commit a draft loadout. Returns false and leaves faces unchanged if gated. */
  commitFaces(faces: ArrayLike<number>): boolean {
    if (!facesLegal(faces, this.found)) return false;
    for (let i = 0; i < FACE_COUNT; i++) this.faces[i] = faces[i] ?? 0;
    return true;
  }

  applyLoadout(found: number, faces: ArrayLike<number> | null): void {
    this.found = found;
    if (faces && facesLegal(faces, found)) {
      for (let i = 0; i < FACE_COUNT; i++) this.faces[i] = faces[i] ?? 0;
    }
  }
}

function hashPlayer(out: SimSnapshot): number {
  const p = out.player;
  const m = out.move;
  let h = fnv1aStart();
  h = fnv1aI32(h, p.x);
  h = fnv1aI32(h, p.y);
  h = fnv1aI32(h, p.z);
  h = fnv1aU32(h, p.orientation);
  h = fnv1aU32(h, p.found);
  for (let i = 0; i < FACE_COUNT; i++) h = fnv1aU8(h, p.faces[i] ?? 0);
  h = fnv1aU32(h, m.mode);
  h = fnv1aU32(h, m.dir);
  h = fnv1aU32(h, m.phase);
  h = fnv1aU32(h, m.duration);
  h = fnv1aI32(h, m.startX);
  h = fnv1aI32(h, m.startY);
  h = fnv1aI32(h, m.startZ);
  h = fnv1aU32(h, m.startOri);
  h = fnv1aI32(h, m.destX);
  h = fnv1aI32(h, m.destY);
  h = fnv1aI32(h, m.destZ);
  h = fnv1aU32(h, m.destOri);
  h = fnv1aU32(h, m.leap);
  h = fnv1aU32(h, m.jumpBuf);
  h = fnv1aU32(h, m.pivotArmed);
  h = fnv1aU32(h, m.moveLock);
  h = fnv1aU32(h, m.flags);
  h = fnv1aF64(h, m.vy);
  return fnv1aF64(h, m.airY);
}

function hashRng(rng: RngBank): number {
  let h = fnv1aStart();
  h = fnv1aU32(h, rng.world.a);
  h = fnv1aU32(h, rng.world.b);
  h = fnv1aU32(h, rng.world.c);
  h = fnv1aU32(h, rng.world.d);
  h = fnv1aU32(h, rng.physics.a);
  h = fnv1aU32(h, rng.physics.b);
  h = fnv1aU32(h, rng.physics.c);
  h = fnv1aU32(h, rng.physics.d);
  h = fnv1aU32(h, rng.combat.a);
  h = fnv1aU32(h, rng.combat.b);
  h = fnv1aU32(h, rng.combat.c);
  return fnv1aU32(h, rng.combat.d);
}

function hashWorld(contentHash: number, tick: number, out: SimSnapshot, fireHash: number): number {
  const w = out.world;
  let h = fnv1aStart();
  h = fnv1aU32(h, contentHash);
  h = fnv1aU32(h, tick);
  h = fnv1aU32(h, out.integrity);
  h = fnv1aU32(h, out.vfx.burnT);
  h = fnv1aU32(h, out.vfx.burnDur);
  h = fnv1aU32(h, out.vfx.pulse);
  h = fnv1aU32(h, out.vfx.boltSeed);
  h = fnv1aU32(h, out.vfx.scorchHash);
  h = fnv1aU32(h, out.vfx.iceHash);
  h = fnv1aU32(h, out.vfx.fireCount);
  h = fnv1aU32(h, fireHash);
  h = fnv1aU32(h, w.sliceOn);
  h = fnv1aU32(h, w.stage);
  h = fnv1aU32(h, w.doorOpen);
  h = fnv1aU32(h, w.shrineTaken);
  h = fnv1aU32(h, w.glyphTaken);
  h = fnv1aU32(h, w.iceTaken);
  h = fnv1aU32(h, w.zigTaken);
  h = fnv1aU32(h, w.iframes);
  h = fnv1aU32(h, w.npcRange);
  h = fnv1aU32(h, w.banner);
  h = fnv1aU32(h, w.region);
  h = fnv1aU32(h, w.aiming);
  h = fnv1aU32(h, w.turretAlive);
  for (let i = 0; i < TURRET_COUNT; i++) {
    h = fnv1aU8(h, w.turretState[i] ?? 0);
    h = fnv1aU32(h, w.turretT[i] ?? 0);
    h = fnv1aU8(h, w.turretResist[i] ?? 0);
    h = fnv1aU8(h, w.teleN[i] ?? 0);
  }
  return h;
}

function combineLayers(h: {
  player: number;
  rng: number;
  world: number;
  input: number;
}): number {
  let x = fnv1aStart();
  x = fnv1aU32(x, h.player);
  x = fnv1aU32(x, h.rng);
  x = fnv1aU32(x, h.world);
  return fnv1aU32(x, h.input);
}
