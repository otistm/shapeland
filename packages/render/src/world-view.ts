import type { AbilityKind } from "@shapeland/content";
import {
  DOOR,
  FLAG_BLAST,
  FLAG_DOOR,
  FLAG_HURT,
  FLAG_KILL,
  GLYPH,
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
  type Terrain,
} from "@shapeland/sim";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DoubleSide,
  Mesh,
  MeshBasicNodeMaterial,
  OctahedronGeometry,
  PlaneGeometry,
  PointLight,
  type Scene,
  type Texture,
} from "three/webgpu";
import { type CameraRig, impactShake } from "./camera";
import { toNonIndexedFacets } from "./geometry";
import { makeToon } from "./toon";

const INK = 0x2e2e38;
const TURRET_R = 0.86;
const TURRET_H = 1.8;
const TELE_RGB = new Color(TELE_COLOR);
const TURRET_INK = new Color(INK);

export interface WorldView {
  present(snapshot: SimSnapshot, dt: number, clock: number, rig: CameraRig): void;
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

function makePickup(x: number, z: number, map: Texture): { icon: Mesh; decal: Mesh } {
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
  decal.position.set(x, 0.006, z);
  const icon = new Mesh(new PlaneGeometry(0.6, 0.6), iconMat);
  icon.position.set(x, 1.05, z);
  return { icon, decal };
}

export function createWorldView(
  scene: Scene,
  terrain: Terrain,
  faceTex: Record<AbilityKind, Texture>,
): WorldView {
  const ink = makeToon({ color: INK });
  const white = makeToon({ color: 0xffffff });
  const gapMat = new MeshBasicNodeMaterial({ color: 0x1c1c24, fog: false });

  terrain.forEachWall((x, z) => {
    const { h, depth } = wallHeight(x, z);
    const m = new Mesh(new BoxGeometry(0.98, h, depth), ink);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    scene.add(m);
  });

  terrain.forEachGap((x, z) => {
    const m = new Mesh(new PlaneGeometry(0.94, 0.94), gapMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.004, z);
    scene.add(m);
  });

  terrain.forEachHeight((x, z, h) => {
    if (h <= 0) return;
    const m = new Mesh(new BoxGeometry(1, h, 1), white);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  });

  const doorSlab = new Mesh(new BoxGeometry(0.98, 3.2, 0.6), ink);
  doorSlab.position.set(DOOR.x, 1.6, DOOR.z);
  doorSlab.castShadow = true;
  scene.add(doorSlab);

  const shrine = makePickup(SHRINE.x, SHRINE.z, faceTex.fire);
  const glyph = makePickup(GLYPH.x, GLYPH.z, faceTex.lightning);
  scene.add(shrine.decal, shrine.icon, glyph.decal, glyph.icon);
  glyph.decal.visible = false;
  glyph.icon.visible = false;

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
  sock.position.set(SOCKET.x, 0.006, SOCKET.z);
  scene.add(sock);

  const cone = toNonIndexedFacets(new ConeGeometry(TURRET_R, TURRET_H, 4));
  const turrets: Mesh[] = [];
  const turretMats: ReturnType<typeof makeToon>[] = [];
  const planes: Mesh[][] = [];
  const spin = new Float64Array(TURRET_COUNT);
  for (let i = 0; i < TURRET_COUNT; i++) {
    const site = TURRET_SITES[i];
    const mat = makeToon({ color: INK });
    const mesh = new Mesh(cone, mat);
    mesh.position.set(site?.[0] ?? 0, TURRET_H / 2, site?.[1] ?? 0);
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
  npc.position.set(NPC.x, 0.72, NPC.z);
  npc.castShadow = true;
  scene.add(npc);
  const lamp = new PointLight(0xffb469, 0.55, 3.2);
  lamp.position.set(NPC.x, 1.1, NPC.z);
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
    present(snapshot, dt, clock, rig) {
      const w = snapshot.world;
      if (snapshot.tick !== lastFlagTick) {
        lastFlagTick = snapshot.tick;
        const flags = snapshot.move.flags;
        if ((flags & FLAG_HURT) !== 0) impactShake(rig, SHAKE_HURT); // impact: hurt
        if ((flags & FLAG_KILL) !== 0) impactShake(rig, SHAKE_SENTRY); // impact: sentry crack
        if ((flags & FLAG_DOOR) !== 0) impactShake(rig, SHAKE_DOOR); // impact: seal opening
        if ((flags & FLAG_BLAST) !== 0) impactShake(rig, SHAKE_BLAST); // impact: sentry blast
      }

      shrine.icon.visible = w.shrineTaken === 0;
      glyph.decal.visible = w.doorOpen !== 0;
      glyph.icon.visible = w.doorOpen !== 0 && w.glyphTaken === 0;
      shrine.icon.position.y = 1.05 + 0.1 * Math.sin(clock * 2.2);
      shrine.icon.rotation.y = clock * 0.8;
      glyph.icon.position.y = 1.05 + 0.1 * Math.sin(clock * 2.2);
      glyph.icon.rotation.y = clock * 0.8;

      if (w.doorOpen !== 0 && doorSlab.position.y > -1.8) {
        doorSlab.position.y -= dt * 1.6;
        const floodMat = flood.material as MeshBasicNodeMaterial;
        floodMat.opacity = Math.min(0.9, (floodMat.opacity ?? 0) + dt * 0.4);
      }

      npc.position.y = 0.72 + 0.07 * Math.sin(clock * 1.4);
      npc.rotation.y = clock * 0.35;

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
        mesh.position.y = TURRET_H / 2 + 0.05 * Math.sin(clock * 2.1 + tx);

        const resist = w.turretResist[i] ?? 0;
        const n = w.teleN[i] ?? 0;
        let glow = 0;
        if (row) {
          for (let k = 0; k < 5; k++) {
            const p = row[k];
            if (!p) continue;
            if (state === TURRET_STATE_AIM && k < n) {
              p.visible = true;
              p.position.set(w.teleX[i * 5 + k] ?? 0, 0.01, w.teleZ[i * 5 + k] ?? 0);
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
    dispose() {},
  };
}
