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
  ICE_GLYPH,
  MODE_ROLL,
  NPC,
  SHAKE_BLAST,
  SHAKE_DOOR,
  SHAKE_HURT,
  SHAKE_SENTRY,
  SHRINE,
  SOCKET,
  ZIG_SOCKET,
  type SimSnapshot,
  TELE_COLOR,
  TURRET_AIM_TICKS,
  TURRET_COOL_TICKS,
  TURRET_COUNT,
  TURRET_SITES,
  TURRET_STATE_AIM,
  TURRET_STATE_COOL,
  type Terrain,
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
import { makeTerrainMaterials } from "./terrain-mat";
import { makeToon } from "./toon";
import {
  makeGrassMaterial,
  makeSwampMaterial,
  makeWaterMaterial,
  surfaceCellAttribute,
} from "./water-mat";

const INK = 0x2e2e38;
/** Sheet quads are inset so the lattice still reads between wet cells. */
const SHEET_SIZE = 0.96;
const TURRET_R = 0.86;
const TURRET_H = 1.8;
const TELE_RGB = new Color(TELE_COLOR);
const TURRET_INK = new Color(INK);

export interface WorldView {
  present(snapshot: SimSnapshot, dt: number, clock: number, rig: CameraRig, reduced: boolean): void;
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

/** One pooled instanced sheet per surface kind, anchored to the height map. */
function stampSheets(
  scene: Scene,
  terrain: Terrain,
  collect: (fn: (x: number, z: number) => void) => void,
  material: MeshBasicNodeMaterial,
  lift: number,
): InstancedMesh {
  const cells: Array<readonly [number, number]> = [];
  collect((x, z) => {
    cells.push([x, z]);
  });
  const geometry = new PlaneGeometry(SHEET_SIZE, SHEET_SIZE);
  const aCell = surfaceCellAttribute(cells.length);
  geometry.setAttribute("aCell", aCell);
  const mesh = new InstancedMesh(geometry, material, Math.max(1, cells.length));
  mesh.count = cells.length;
  const dummy = new Object3D();
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (!cell) continue;
    const x = cell[0];
    const z = cell[1];
    aCell.setXY(i, x, z);
    dummy.position.set(x, terrain.height(x, z) + lift, z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  aCell.needsUpdate = true;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
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
  for (const [h, cells] of pierCells) {
    const mesh = new InstancedMesh(new BoxGeometry(1, h, 1), ink, cells.length);
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (!cell) continue;
      pierDummy.position.set(cell[0], h / 2, cell[1]);
      pierDummy.rotation.set(0, 0, 0);
      pierDummy.updateMatrix();
      mesh.setMatrixAt(i, pierDummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    pierMeshes.push(mesh);
  }

  const water = makeWaterMaterial();
  const swampMat = makeSwampMaterial();
  const grass = makeGrassMaterial();
  const waterMesh = stampSheets(
    scene,
    terrain,
    (fn) => terrain.forEachWater(fn),
    water.material,
    0.012,
  );
  const swampMesh = stampSheets(scene, terrain, (fn) => terrain.forEachSwamp(fn), swampMat, 0.01);
  const grassMesh = stampSheets(scene, terrain, (fn) => terrain.forEachGrass(fn), grass.material, 0.008);

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

  return {
    present(snapshot, dt, clock, rig, reduced) {
      const w = snapshot.world;
      if (snapshot.tick !== lastFlagTick) {
        lastFlagTick = snapshot.tick;
        const flags = snapshot.move.flags;
        if ((flags & FLAG_HURT) !== 0) impactShake(rig, SHAKE_HURT); // impact: hurt
        if ((flags & FLAG_KILL) !== 0) impactShake(rig, SHAKE_SENTRY); // impact: sentry crack
        if ((flags & FLAG_DOOR) !== 0) impactShake(rig, SHAKE_DOOR); // impact: seal opening
        if ((flags & FLAG_BLAST) !== 0) impactShake(rig, SHAKE_BLAST); // impact: sentry blast
        if ((flags & FLAG_LAND) !== 0 && terrain.isWater(snapshot.player.x, snapshot.player.z)) {
          splashT = 0.28;
          splash.position.set(snapshot.player.x, snapshot.player.y + 0.03, snapshot.player.z);
          splash.visible = true;
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
      water.setClock(reduced ? 0 : clock);
      grass.setClock(reduced ? 0 : clock);
      if (
        !reduced &&
        snapshot.move.mode === MODE_ROLL &&
        terrain.isGrass(snapshot.move.destX, snapshot.move.destZ)
      ) {
        const dur = snapshot.move.duration;
        const t = dur > 0 ? snapshot.move.phase / dur : 0;
        const k = t * (1 - t) * 4;
        const dir = snapshot.move.dir;
        grass.setLean((DIR_DX[dir] ?? 0) * k, (DIR_DZ[dir] ?? 0) * k);
      } else {
        grass.setLean(0, 0);
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
          continue;
        }
        const state = w.turretState[i] ?? 0;
        const t = w.turretT[i] ?? 0;
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
        mesh.position.y = (turretH[i] ?? 0) + TURRET_H / 2 + 0.05 * Math.sin(clock * 2.1 + tx);

        const resist = w.turretResist[i] ?? 0;
        const n = w.teleN[i] ?? 0;
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
    },
    dispose() {
      for (const mesh of [waterMesh, swampMesh, grassMesh, gapMesh, ...columnMeshes, ...pierMeshes]) {
        mesh.removeFromParent();
        mesh.geometry.dispose();
      }
      water.material.dispose();
      swampMat.dispose();
      grass.material.dispose();
    },
  };
}
