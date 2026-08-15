import type { AbilityKind } from "@shapeland/content";
import {
  DIR_DX,
  DIR_DZ,
  DOOR,
  FLAG_BLAST,
  FLAG_DOOR,
  FLAG_HURT,
  FLAG_KILL,
  FLAG_LAND,
  GLYPH,
  HOSTILE_CONE_SPIRE,
  HOSTILE_CONE_WATCH,
  HOSTILE_COUNT,
  HOSTILE_SITES,
  HOSTILE_SPIKE_TICKS,
  HOSTILE_TETRA,
  TURRET_RANGE2,
  ICE_GLYPH,
  MODE_ROLL,
  NPC,
  SHAKE_BLAST,
  SHAKE_DOOR,
  SHAKE_HURT,
  SHAKE_SENTRY,
  SHRINE,
  SOCKET,
  type SimSnapshot,
  TELE_COLOR,
  TURRET_AIM_TICKS,
  TURRET_COOL_TICKS,
  TURRET_COUNT,
  TURRET_SITES,
  TURRET_STATE_AIM,
  TURRET_STATE_COOL,
  hostileAimTicks,
  hostileRange2,
  type Terrain,
  ZIG_SOCKET,
} from "@shapeland/sim";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  InstancedMesh,
  Mesh,
  MeshBasicNodeMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  type Scene,
  type Texture,
} from "three/webgpu";
import { type CameraRig, impactShake } from "./camera";
import { toNonIndexedFacets } from "./geometry";
import { createLunge, spikeRise, stepLunge } from "./lunge";
import { pierCutawayDist2, pierCutawayHidden } from "./pier-cutaway";
import { makeTerrainMaterials } from "./terrain-mat";
import { makeToon } from "./toon";
import { createWaterRide, stepWaterRide } from "./water-body";
import {
  WATER_SPLASH_LAND,
  WATER_SPLASH_R,
  WATER_SPLASH_ROLL,
  WATER_SURFACE,
  createWaterField,
} from "./water-field";
import {
  makeGrassMaterial,
  makeSwampMaterial,
  makeWaterFloorMaterial,
  makeWaterMaterial,
  surfaceBaseAttribute,
  surfaceCellAttribute,
} from "./water-mat";

const INK = 0x2e2e38;
/** Sheet quads are inset so the lattice still reads between wet cells. */
const SHEET_SIZE = 0.96;
const TURRET_R = 0.86;
const TURRET_H = 1.8;
const WATCH_R = 1.15;
const WATCH_H = 2.8;
const SPIRE_R = 1.45;
const SPIRE_H = 4.4;
const TETRA_R = 0.95;
const TETRA_H = 1.55;
const TELE_RGB = new Color(TELE_COLOR);
const TURRET_INK = new Color(INK);

function hostileSize(kind: number): { r: number; h: number } {
  if (kind === HOSTILE_CONE_WATCH) return { r: WATCH_R, h: WATCH_H };
  if (kind === HOSTILE_CONE_SPIRE) return { r: SPIRE_R, h: SPIRE_H };
  if (kind === HOSTILE_TETRA) return { r: TETRA_R, h: TETRA_H };
  return { r: TURRET_R, h: TURRET_H };
}

export interface WorldView {
  /**
   * Visual Y offset from water buoyancy, written by the last `present`. Lattice position and
   * camera resting height never see it.
   */
  readonly waterBob: number;
  present(
    snapshot: SimSnapshot,
    dt: number,
    clock: number,
    rig: CameraRig,
    reduced: boolean,
    cube?: { x: number; y: number; z: number },
  ): void;
  dispose(): void;
}

function wallHeight(x: number, z: number): { h: number; depth: number } {
  const gateFace = z === DOOR.z;
  const h = gateFace
    ? 3.4 + Math.abs(x) * 0.55 + ((Math.abs(x) * 7) % 3) * 0.3
    : 1.9 + ((Math.abs(x * 3 + z) * 5) % 3) * 0.25;
  return { h, depth: gateFace ? 0.6 : 0.98 };
}

function socketTexture(fire: Texture): CanvasTexture {
  const src = fire.image as HTMLCanvasElement | undefined;
  const c = document.createElement("canvas");
  c.width = src?.width ?? 256;
  c.height = src?.height ?? 256;
  const g = c.getContext("2d");
  if (g) {
    if (src) g.drawImage(src, 0, 0, c.width, c.height);
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "#888";
    g.fillRect(0, 0, c.width, c.height);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function floodTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 200;
  const g = c.getContext("2d");
  if (g) {
    const grd = g.createRadialGradient(128, 100, 10, 128, 100, 150);
    grd.addColorStop(0, "rgba(255,150,60,0.5)");
    grd.addColorStop(0.55, "rgba(255,190,90,0.22)");
    grd.addColorStop(1, "rgba(255,190,90,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 200);
  }
  const tex = new CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}

function makePickup(
  x: number,
  z: number,
  map: Texture,
  ground: number,
): { icon: Mesh; decal: Mesh } {
  const decalMat = new MeshBasicNodeMaterial({
    map,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    fog: false,
  });
  const iconMat = new MeshBasicNodeMaterial({
    map,
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
  });
  const decal = new Mesh(new PlaneGeometry(0.92, 0.92), decalMat);
  decal.rotation.x = -Math.PI / 2;
  decal.position.set(x, ground + 0.006, z);
  const icon = new Mesh(new PlaneGeometry(0.6, 0.6), iconMat);
  icon.position.set(x, ground + 1.05, z);
  return { icon, decal };
}

interface SheetOpts {
  /** Quad edge. Water uses a full cell so neighbouring puddle cells form one continuous surface. */
  size?: number;
  segs?: number;
  renderOrder?: number;
  /** Emit `aBase` (resting surface Y) for shaders that need a real world-space point. */
  base?: boolean;
}

/** One pooled instanced sheet per surface kind, anchored to the height map. */
function stampSheets(
  scene: Scene,
  terrain: Terrain,
  collect: (fn: (x: number, z: number) => void) => void,
  material: MeshBasicNodeMaterial,
  lift: number,
  opts: SheetOpts = {},
): InstancedMesh {
  const cells: Array<readonly [number, number]> = [];
  collect((x, z) => {
    cells.push([x, z]);
  });
  const size = opts.size ?? SHEET_SIZE;
  const segs = opts.segs ?? 1;
  const geometry = new PlaneGeometry(size, size, segs, segs);
  const aCell = surfaceCellAttribute(cells.length);
  geometry.setAttribute("aCell", aCell);
  const aBase = opts.base ? surfaceBaseAttribute(cells.length) : null;
  if (aBase) geometry.setAttribute("aBase", aBase);
  const mesh = new InstancedMesh(geometry, material, Math.max(1, cells.length));
  mesh.count = cells.length;
  const dummy = new Object3D();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;
    const x = cell[0];
    const z = cell[1];
    aCell.setXY(i, x, z);
    aBase?.setX(i, terrain.height(x, z) + lift);
    dummy.position.set(x, terrain.height(x, z) + lift, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  aCell.needsUpdate = true;
  if (aBase) aBase.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = opts.renderOrder ?? 1;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  scene.add(mesh);
  return mesh;
}

export function createWorldView(
  scene: Scene,
  terrain: Terrain,
  faceTex: Record<AbilityKind, Texture>,
): WorldView {
  const ink = makeToon({ color: INK });
  const gapMat = new MeshBasicNodeMaterial({ color: 0x1c1c24, fog: false });
  const heightSet = new Set<number>();
  terrain.forEachHeight((_x, _z, h) => {
    if (h > 0) heightSet.add(h);
  });
  const terrainMats = makeTerrainMaterials(heightSet);

  terrain.forEachWall((x, z, h) => {
    if (h > 0) return;
    const look = wallHeight(x, z);
    const m = new Mesh(new BoxGeometry(0.98, look.h, look.depth), ink);
    m.position.set(x, look.h / 2, z);
    m.castShadow = true;
    scene.add(m);
  });

  const gapCells: Array<readonly [number, number]> = [];
  terrain.forEachGap((x, z) => {
    gapCells.push([x, z]);
  });
  const gapMesh = new InstancedMesh(
    new PlaneGeometry(0.94, 0.94),
    gapMat,
    Math.max(1, gapCells.length),
  );
  gapMesh.count = gapCells.length;
  const gapDummy = new Object3D();
  for (let i = 0; i < gapCells.length; i++) {
    const cell = gapCells[i];
    if (!cell) continue;
    gapDummy.position.set(cell[0], 0.004, cell[1]);
    gapDummy.rotation.set(-Math.PI / 2, 0, 0);
    gapDummy.updateMatrix();
    gapMesh.setMatrixAt(i, gapDummy.matrix);
  }
  gapMesh.instanceMatrix.needsUpdate = true;
  gapMesh.frustumCulled = false;
  scene.add(gapMesh);

  // One instanced draw per height band. A full district bake raises tens of thousands of cells, so
  // a Mesh per column is not a budget question, it is a hard failure.
  const columnCells = new Map<number, Array<readonly [number, number]>>();
  terrain.forEachHeight((x, z, h) => {
    if (h <= 0 || terrain.isWall(x, z)) return;
    const bucket = columnCells.get(h);
    if (bucket) bucket.push([x, z]);
    else columnCells.set(h, [[x, z]]);
  });
  const columnMeshes: InstancedMesh[] = [];
  const columnDummy = new Object3D();
  for (const [h, cells] of columnCells) {
    const side = terrainMats.side.get(h) ?? terrainMats.top;
    const mesh = new InstancedMesh(
      new BoxGeometry(1, h, 1),
      [side, side, terrainMats.top, side, side, side],
      cells.length,
    );
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      columnDummy.position.set(cell[0], h / 2, cell[1]);
      columnDummy.rotation.set(0, 0, 0);
      columnDummy.updateMatrix();
      mesh.setMatrixAt(i, columnDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    columnMeshes.push(mesh);
  }

  const pierCells = new Map<number, Array<readonly [number, number]>>();
  terrain.forEachWall((x, z, h) => {
    if (h < 1) return;
    const bucket = pierCells.get(h);
    if (bucket) bucket.push([x, z]);
    else pierCells.set(h, [[x, z]]);
  });
  const pierMeshes: InstancedMesh[] = [];
  const pierDummy = new Object3D();
  const pierBuckets: Array<{
    mesh: InstancedMesh;
    h: number;
    xs: Int16Array;
    zs: Int16Array;
    hidden: Uint8Array;
  }> = [];
  const writePierMatrix = (
    xs: Int16Array,
    zs: Int16Array,
    h: number,
    i: number,
    hide: number,
  ): void => {
    pierDummy.position.set(xs[i] ?? 0, h / 2, zs[i] ?? 0);
    const s = hide === 1 ? 0 : 1;
    pierDummy.scale.set(s, s, s);
    pierDummy.rotation.set(0, 0, 0);
    pierDummy.updateMatrix();
  };
  for (const [h, cells] of pierCells) {
    const mesh = new InstancedMesh(new BoxGeometry(1, h, 1), ink, cells.length);
    const xs = new Int16Array(cells.length);
    const zs = new Int16Array(cells.length);
    const hidden = new Uint8Array(cells.length);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      xs[i] = cell[0];
      zs[i] = cell[1];
      writePierMatrix(xs, zs, h, i, 0);
      mesh.setMatrixAt(i, pierDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    pierMeshes.push(mesh);
    pierBuckets.push({ mesh, h, xs, zs, hidden });
  }

  const field = createWaterField();
  const water = makeWaterMaterial(field.texture);
  const poolFloor = makeWaterFloorMaterial(field.texture);
  const swampMat = makeSwampMaterial();
  const grass = makeGrassMaterial();
  // Two layers, like the demo: caustics live on the pool bottom, the refracting film sits above.
  const poolMesh = stampSheets(
    scene,
    terrain,
    (fn) => terrain.forEachWater(fn),
    poolFloor.material,
    0.012,
    { size: 1, renderOrder: 1 },
  );
  const waterMesh = stampSheets(
    scene,
    terrain,
    (fn) => terrain.forEachWater(fn),
    water.material,
    WATER_SURFACE,
    { size: 1, segs: 10, renderOrder: 2, base: true },
  );
  const swampMesh = stampSheets(scene, terrain, (fn) => terrain.forEachSwamp(fn), swampMat, 0.01);
  const grassMesh = stampSheets(
    scene,
    terrain,
    (fn) => terrain.forEachGrass(fn),
    grass.material,
    0.008,
  );

  const doorSlab = new Mesh(new BoxGeometry(0.98, 3.2, 0.6), ink);
  doorSlab.position.set(DOOR.x, 1.6, DOOR.z);
  doorSlab.castShadow = true;
  scene.add(doorSlab);

  const shrineH = terrain.height(SHRINE.x, SHRINE.z);
  const glyphH = terrain.height(GLYPH.x, GLYPH.z);
  const iceH = terrain.height(ICE_GLYPH.x, ICE_GLYPH.z);
  const socketH = terrain.height(SOCKET.x, SOCKET.z);
  const npcH = terrain.height(NPC.x, NPC.z);
  const shrine = makePickup(SHRINE.x, SHRINE.z, faceTex.fire, shrineH);
  const glyph = makePickup(GLYPH.x, GLYPH.z, faceTex.lightning, glyphH);
  const ice = makePickup(ICE_GLYPH.x, ICE_GLYPH.z, faceTex.ice, iceH);
  scene.add(shrine.decal, shrine.icon, glyph.decal, glyph.icon, ice.decal, ice.icon);
  glyph.decal.visible = false;
  glyph.icon.visible = false;
  ice.decal.visible = false;
  ice.icon.visible = false;

  const sock = new Mesh(
    new PlaneGeometry(0.92, 0.92),
    new MeshBasicNodeMaterial({
      map: socketTexture(faceTex.fire),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    }),
  );
  sock.rotation.x = -Math.PI / 2;
  sock.position.set(SOCKET.x, socketH + 0.006, SOCKET.z);
  scene.add(sock);

  const zigH = terrain.height(ZIG_SOCKET.x, ZIG_SOCKET.z);
  const zigSock = new Mesh(
    new PlaneGeometry(0.92, 0.92),
    new MeshBasicNodeMaterial({
      map: socketTexture(faceTex.fire),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      fog: false,
    }),
  );
  zigSock.rotation.x = -Math.PI / 2;
  zigSock.position.set(ZIG_SOCKET.x, zigH + 0.006, ZIG_SOCKET.z);
  scene.add(zigSock);

  const splashMat = new MeshBasicNodeMaterial({
    color: 0x4a7a88,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false,
  });
  const splash = new Mesh(new PlaneGeometry(1.15, 1.15), splashMat);
  splash.rotation.x = -Math.PI / 2;
  splash.visible = false;
  splash.renderOrder = 2;
  scene.add(splash);
  let splashT = 0;

  const cone = toNonIndexedFacets(new ConeGeometry(TURRET_R, TURRET_H, 4));
  const turrets: Mesh[] = [];
  const turretMats: ReturnType<typeof makeToon>[] = [];
  const planes: Mesh[][] = [];
  const spin = new Float64Array(TURRET_COUNT);
  const turretH = new Float32Array(TURRET_COUNT);
  for (let i = 0; i < TURRET_COUNT; i++) {
    const site = TURRET_SITES[i];
    const mat = makeToon({ color: INK });
    const mesh = new Mesh(cone, mat);
    const gx = site?.[0] ?? 0;
    const gz = site?.[1] ?? 0;
    turretH[i] = terrain.height(gx, gz);
    mesh.position.set(gx, (turretH[i] ?? 0) + TURRET_H / 2, gz);
    mesh.castShadow = true;
    scene.add(mesh);
    turrets.push(mesh);
    turretMats.push(mat);
    const row: Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(
        new PlaneGeometry(0.94, 0.94),
        new MeshBasicNodeMaterial({
          color: TELE_COLOR,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
        }),
      );
      p.rotation.x = -Math.PI / 2;
      p.visible = false;
      scene.add(p);
      row.push(p);
    }
    planes.push(row);
  }

  const spikeGeo = toNonIndexedFacets(new ConeGeometry(0.2, 0.92, 3));
  const makeSpikeRow = (): Mesh[] => {
    const row: Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(
        spikeGeo,
        new MeshBasicNodeMaterial({
          color: TELE_COLOR,
          fog: false,
        }),
      );
      p.visible = false;
      p.castShadow = true;
      scene.add(p);
      row.push(p);
    }
    return row;
  };
  const turretSpikes: Mesh[][] = [];
  const turretLunges = Array.from({ length: TURRET_COUNT }, () => createLunge());
  for (let i = 0; i < TURRET_COUNT; i++) turretSpikes.push(makeSpikeRow());

  const scoutGeo = toNonIndexedFacets(new ConeGeometry(TURRET_R, TURRET_H, 4));
  const watchGeo = toNonIndexedFacets(new ConeGeometry(WATCH_R, WATCH_H, 4));
  const spireGeo = toNonIndexedFacets(new ConeGeometry(SPIRE_R, SPIRE_H, 4));
  const tetraGeo = toNonIndexedFacets(new ConeGeometry(TETRA_R, TETRA_H, 3));
  const hostiles: Mesh[] = [];
  const hostileMats: ReturnType<typeof makeToon>[] = [];
  const hostilePlanes: Mesh[][] = [];
  const hostileSpin = new Float64Array(HOSTILE_COUNT);
  for (let i = 0; i < HOSTILE_COUNT; i++) {
    const kind = HOSTILE_SITES[i]?.[0] ?? 0;
    const geo =
      kind === HOSTILE_TETRA
        ? tetraGeo
        : kind === HOSTILE_CONE_SPIRE
          ? spireGeo
          : kind === HOSTILE_CONE_WATCH
            ? watchGeo
            : scoutGeo;
    const mat = makeToon({ color: INK });
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    scene.add(mesh);
    hostiles.push(mesh);
    hostileMats.push(mat);
    const row: Mesh[] = [];
    for (let k = 0; k < 5; k++) {
      const p = new Mesh(
        new PlaneGeometry(0.94, 0.94),
        new MeshBasicNodeMaterial({
          color: TELE_COLOR,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          fog: false,
        }),
      );
      p.rotation.x = -Math.PI / 2;
      p.visible = false;
      scene.add(p);
      row.push(p);
    }
    hostilePlanes.push(row);
  }
  const hostileSpikes: Mesh[][] = [];
  const hostileLunges = Array.from({ length: HOSTILE_COUNT }, () => createLunge());
  for (let i = 0; i < HOSTILE_COUNT; i++) hostileSpikes.push(makeSpikeRow());

  const npc = new Mesh(new OctahedronGeometry(0.46), makeToon({ color: INK }));
  npc.position.set(NPC.x, npcH + 0.72, NPC.z);
  npc.castShadow = true;
  scene.add(npc);
  const lamp = new PointLight(0xffb469, 0.55, 3.2);
  lamp.position.set(NPC.x, npcH + 1.1, NPC.z);
  scene.add(lamp);

  const flood = new Mesh(
    new PlaneGeometry(5.4, 5.4),
    new MeshBasicNodeMaterial({
      map: floodTexture(),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      fog: false,
    }),
  );
  flood.rotation.x = -Math.PI / 2;
  flood.position.set(0, 0.005, -25);
  scene.add(flood);

  let lastFlagTick = -1;
  let strikeBlast = false;
  const ride = createWaterRide();
  let bobY = 0;

  const presentSpikes = (
    row: Mesh[] | undefined,
    teleX: ArrayLike<number>,
    teleZ: ArrayLike<number>,
    base: number,
    n: number,
    state: number,
    t: number,
    reducedMotion: boolean,
  ): void => {
    const rising = state === TURRET_STATE_COOL && t > 0 && t <= HOSTILE_SPIKE_TICKS;
    const h = rising ? spikeRise(t, HOSTILE_SPIKE_TICKS, reducedMotion) : 0;
    if (!row) return;
    for (let k = 0; k < 5; k++) {
      const p = row[k];
      if (!p) continue;
      if (rising && k < n && h > 0) {
        const cx = teleX[base + k] ?? 0;
        const cz = teleZ[base + k] ?? 0;
        p.visible = true;
        p.scale.set(1, h, 1);
        p.position.set(cx, terrain.height(cx, cz) + 0.46 * h, cz);
      } else {
        p.visible = false;
      }
    }
  };

  return {
    get waterBob() {
      return bobY;
    },
    present(snapshot, dt, clock, rig, reduced, cube) {
      const w = snapshot.world;
      strikeBlast = false;
      if (snapshot.tick !== lastFlagTick) {
        lastFlagTick = snapshot.tick;
        const flags = snapshot.move.flags;
        strikeBlast = (flags & FLAG_BLAST) !== 0;
        if ((flags & FLAG_HURT) !== 0) impactShake(rig, SHAKE_HURT); // impact: hurt
        if ((flags & FLAG_KILL) !== 0) impactShake(rig, SHAKE_SENTRY); // impact: sentry crack
        if ((flags & FLAG_DOOR) !== 0) impactShake(rig, SHAKE_DOOR); // impact: seal opening
        if ((flags & FLAG_BLAST) !== 0) impactShake(rig, SHAKE_BLAST); // impact: sentry blast
        // Every arrival in water throws a drop, not just a jump landing. Jump refuses from a wet
        // cell (ADR 0013), so keying the splash off FLAG_LAND alone meant rolling — the only way
        // a player ever actually enters water — never disturbed it.
        const rollingIn =
          snapshot.move.mode === MODE_ROLL &&
          snapshot.move.phase === 1 &&
          terrain.isWater(snapshot.move.destX, snapshot.move.destZ);
        const landingIn =
          (flags & FLAG_LAND) !== 0 && terrain.isWater(snapshot.player.x, snapshot.player.z);
        if (rollingIn || landingIn) {
          const sx = rollingIn ? snapshot.move.destX : snapshot.player.x;
          const sz = rollingIn ? snapshot.move.destZ : snapshot.player.z;
          field.addDrop(sx, sz, WATER_SPLASH_R, rollingIn ? WATER_SPLASH_ROLL : WATER_SPLASH_LAND);
          if (landingIn) {
            splashT = 0.28;
            splash.position.set(sx, terrain.height(sx, sz) + WATER_SURFACE + 0.02, sz);
            splash.visible = true;
          }
        }
      }

      shrine.icon.visible = w.shrineTaken === 0;
      glyph.decal.visible = w.doorOpen !== 0;
      glyph.icon.visible = w.doorOpen !== 0 && w.glyphTaken === 0;
      ice.decal.visible = w.doorOpen !== 0;
      ice.icon.visible = w.doorOpen !== 0 && w.iceTaken === 0;
      shrine.icon.position.y = shrineH + 1.05 + 0.1 * Math.sin(clock * 2.2);
      shrine.icon.rotation.y = clock * 0.8;
      glyph.icon.position.y = glyphH + 1.05 + 0.1 * Math.sin(clock * 2.2);
      glyph.icon.rotation.y = clock * 0.8;
      ice.icon.position.y = iceH + 1.05 + 0.1 * Math.sin(clock * 2.2);
      ice.icon.rotation.y = clock * 0.8;
      zigSock.visible = w.zigTaken === 0;

      if (splashT > 0) {
        splashT -= dt;
        splashMat.opacity = Math.max(0, splashT / 0.28) * 0.35;
        const k = 1 + (0.28 - splashT) * 2.4;
        splash.scale.set(k, k, 1);
        splash.visible = splashT > 0;
      }

      if (w.doorOpen !== 0 && doorSlab.position.y > -1.8) {
        doorSlab.position.y -= dt * 1.6;
        const floodMat = flood.material as MeshBasicNodeMaterial;
        floodMat.opacity = Math.min(0.9, (floodMat.opacity ?? 0) + dt * 0.4);
      }

      npc.position.y = npcH + 0.72 + 0.07 * Math.sin(clock * 1.4);
      npc.rotation.y = clock * 0.35;
      const cubeX = cube?.x ?? snapshot.player.x;
      const cubeY = cube?.y ?? snapshot.player.y;
      const cubeZ = cube?.z ?? snapshot.player.z;
      const gx = Math.round(cubeX);
      const gz = Math.round(cubeZ);
      const inWater =
        terrain.isWater(gx, gz) ||
        terrain.isWater(snapshot.player.x, snapshot.player.z) ||
        (snapshot.move.mode === MODE_ROLL &&
          terrain.isWater(snapshot.move.destX, snapshot.move.destZ));
      const restY = terrain.height(gx, gz) + WATER_SURFACE;
      field.recenter(gx, gz);
      field.coupleCube(cubeX, cubeY, cubeZ, restY, inWater);
      field.step(reduced);
      water.setFieldOrigin(field.originX, field.originZ);
      poolFloor.setFieldOrigin(field.originX, field.originZ);
      water.setClock(reduced ? 0 : clock);
      poolFloor.setClock(reduced ? 0 : clock);
      grass.setClock(reduced ? 0 : clock);
      // A passing wake lifts the cube. It never pushes it down: the cube's bottom already rests on
      // the cell floor, so a negative offset would clip straight into the terrain.
      bobY = reduced ? 0 : stepWaterRide(ride, inWater ? field.sampleSmooth(cubeX, cubeZ) : 0, dt);
      if (
        !reduced &&
        snapshot.move.mode === MODE_ROLL &&
        terrain.isGrass(snapshot.move.destX, snapshot.move.destZ)
      ) {
        const dur = snapshot.move.duration;
        const t = dur > 0 ? snapshot.move.phase / dur : 0;
        const k = t * (1 - t) * 4;
        const dir = snapshot.move.dir;
        grass.setLean(
          (DIR_DX[dir] ?? 0) * k,
          (DIR_DZ[dir] ?? 0) * k,
          snapshot.move.destX,
          snapshot.move.destZ,
        );
      } else {
        grass.setLean(0, 0);
      }

      // Near-side structure piers scale to 0. Occupancy is unchanged; the far wall stays.
      for (const bucket of pierBuckets) {
        let dirty = false;
        const n = bucket.xs.length;
        for (let i = 0; i < n; i++) {
          const d2 = pierCutawayDist2(
            bucket.xs[i] ?? 0,
            bucket.zs[i] ?? 0,
            cubeX,
            cubeZ,
            rig.position.x,
            rig.position.z,
          );
          const next = pierCutawayHidden(bucket.hidden[i] ?? 0, d2);
          if (next === (bucket.hidden[i] ?? 0)) continue;
          bucket.hidden[i] = next;
          writePierMatrix(bucket.xs, bucket.zs, bucket.h, i, next);
          bucket.mesh.setMatrixAt(i, pierDummy.matrix);
          dirty = true;
        }
        if (dirty) bucket.mesh.instanceMatrix.needsUpdate = true;
      }

      for (let i = 0; i < TURRET_COUNT; i++) {
        const mesh = turrets[i];
        const mat = turretMats[i];
        if (!mesh || !mat) continue;
        const alive = (w.turretAlive & (1 << i)) !== 0;
        mesh.visible = alive;
        const row = planes[i];
        if (!alive) {
          if (row) for (const p of row) p.visible = false;
          const deadSpikes = turretSpikes[i];
          if (deadSpikes) for (const p of deadSpikes) p.visible = false;
          continue;
        }
        const state = w.turretState[i] ?? 0;
        const t = w.turretT[i] ?? 0;
        const n = w.teleN[i] ?? 0;
        let rate = 0.5;
        if (state === TURRET_STATE_AIM) {
          const k = t / TURRET_AIM_TICKS;
          rate = 0.5 + k * k * 12;
        } else if (state === TURRET_STATE_COOL) {
          rate = 0.5 + 3.5 * (1 - t / TURRET_COOL_TICKS);
        }
        spin[i] = (spin[i] ?? 0) + dt * rate;
        mesh.rotation.y = (spin[i] ?? 0) + Math.PI / 4;
        const tx = TURRET_SITES[i]?.[0] ?? 0;
        const tz = TURRET_SITES[i]?.[1] ?? 0;
        const restY = (turretH[i] ?? 0) + TURRET_H / 2 + 0.05 * Math.sin(clock * 2.1 + tx);
        const lunge = turretLunges[i];
        if (lunge) {
          stepLunge(
            lunge,
            tx,
            restY,
            tz,
            cubeX,
            cubeY,
            cubeZ,
            state,
            t,
            TURRET_AIM_TICKS,
            strikeBlast && state === TURRET_STATE_COOL && t === 0,
            dt,
            reduced,
            TURRET_RANGE2,
            false,
          );
          mesh.position.set(tx + lunge.x, restY + lunge.y, tz + lunge.z);
        } else mesh.position.set(tx, restY, tz);
        presentSpikes(turretSpikes[i], w.teleX, w.teleZ, i * 5, n, state, t, reduced);

        const resist = w.turretResist[i] ?? 0;
        let glow = 0;
        if (row) {
          for (let k = 0; k < 5; k++) {
            const p = row[k];
            if (!p) continue;
            if (state === TURRET_STATE_AIM && k < n) {
              p.visible = true;
              const cx = w.teleX[i * 5 + k] ?? 0;
              const cz = w.teleZ[i * 5 + k] ?? 0;
              p.position.set(cx, terrain.height(cx, cz) + 0.01, cz);
              const kAim = t / TURRET_AIM_TICKS;
              const pulse = 0.14 + 0.3 * kAim + 0.14 * Math.sin(clock * (8 + kAim * 14));
              (p.material as MeshBasicNodeMaterial).opacity = pulse;
              glow = Math.max(glow, pulse * 1.7);
            } else {
              p.visible = false;
            }
          }
        }
        if (state === TURRET_STATE_COOL && t < 12) glow = 1.6;
        const gl = glow > 1.6 ? 1.6 : glow;
        mat.color.copy(TURRET_INK).lerp(TELE_RGB, Math.min(0.75, gl * 0.55));
        if (resist > 0) mat.color.setRGB(0.28, 0.3, 0.36);
      }

      for (let i = 0; i < HOSTILE_COUNT; i++) {
        const mesh = hostiles[i];
        const mat = hostileMats[i];
        if (!mesh || !mat) continue;
        const alive = (w.hostileAlive[i] ?? 0) !== 0;
        mesh.visible = alive;
        const row = hostilePlanes[i];
        if (!alive) {
          if (row) for (const p of row) p.visible = false;
          const deadSpikes = hostileSpikes[i];
          if (deadSpikes) for (const p of deadSpikes) p.visible = false;
          continue;
        }
        const kind = w.hostileKind[i] ?? 0;
        const size = hostileSize(kind);
        const hx = w.hostileX[i] ?? 0;
        const hz = w.hostileZ[i] ?? 0;
        const ground = terrain.height(hx, hz);
        const state = w.hostileState[i] ?? 0;
        const t = w.hostileT[i] ?? 0;
        const aimTicks = hostileAimTicks(kind);
        const n = w.hostileTeleN[i] ?? 0;
        let rate = 0.5;
        if (state === TURRET_STATE_AIM) {
          const k = t / aimTicks;
          rate = 0.5 + k * k * 12;
        } else if (state === TURRET_STATE_COOL) {
          rate = 0.5 + 3.5 * (1 - t / TURRET_COOL_TICKS);
        }
        hostileSpin[i] = (hostileSpin[i] ?? 0) + dt * rate;
        mesh.rotation.y = (hostileSpin[i] ?? 0) + Math.PI / 4;
        const restY = ground + size.h / 2 + 0.05 * Math.sin(clock * 2.1 + hx);
        const lunge = hostileLunges[i];
        if (lunge) {
          stepLunge(
            lunge,
            hx,
            restY,
            hz,
            cubeX,
            cubeY,
            cubeZ,
            state,
            t,
            aimTicks,
            strikeBlast && state === TURRET_STATE_COOL && t === 0,
            dt,
            reduced,
            hostileRange2(kind),
            true,
          );
          mesh.position.set(hx + lunge.x, restY + lunge.y, hz + lunge.z);
        } else mesh.position.set(hx, restY, hz);
        presentSpikes(hostileSpikes[i], w.hostileTeleX, w.hostileTeleZ, i * 5, n, state, t, reduced);

        const resist = w.hostileResist[i] ?? 0;
        let glow = 0;
        if (row) {
          for (let k = 0; k < 5; k++) {
            const p = row[k];
            if (!p) continue;
            if (state === TURRET_STATE_AIM && k < n) {
              p.visible = true;
              const cx = w.hostileTeleX[i * 5 + k] ?? 0;
              const cz = w.hostileTeleZ[i * 5 + k] ?? 0;
              p.position.set(cx, terrain.height(cx, cz) + 0.01, cz);
              const kAim = t / aimTicks;
              const pulse = 0.14 + 0.3 * kAim + 0.14 * Math.sin(clock * (8 + kAim * 14));
              (p.material as MeshBasicNodeMaterial).opacity = pulse;
              glow = Math.max(glow, pulse * 1.7);
            } else {
              p.visible = false;
            }
          }
        }
        if (state === TURRET_STATE_COOL && t < 12) glow = 1.6;
        const gl = glow > 1.6 ? 1.6 : glow;
        mat.color.copy(TURRET_INK).lerp(TELE_RGB, Math.min(0.75, gl * 0.55));
        if (resist > 0) mat.color.setRGB(0.28, 0.3, 0.36);
      }
    },
    dispose() {
      for (const mesh of [
        waterMesh,
        poolMesh,
        swampMesh,
        grassMesh,
        gapMesh,
        ...columnMeshes,
        ...pierMeshes,
        ...hostiles,
      ]) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      water.material.dispose();
      poolFloor.material.dispose();
      field.texture.dispose();
      swampMat.dispose();
      grass.material.dispose();
    },
  };
}
