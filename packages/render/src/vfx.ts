import {
  CAM_KICK_PHYS,
  FIRE_MAX,
  ICE_MAX,
  SHAKE_BOLT,
  SHAKE_FIRE,
  SHAKE_ICE,
  SHAKE_PHYS,
  SPREAD_DUR,
  SPREAD_R,
  type SimSnapshot,
  VFX_PULSE_BOLT,
  VFX_PULSE_FIRE,
  VFX_PULSE_ICE,
  VFX_PULSE_PHYS,
  burnIntensity,
  generateBolt,
  unpackXZ,
} from "@shapeland/sim";
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  Object3D,
  PlaneGeometry,
  PointLight,
  type Scene,
} from "three/webgpu";
import { type CameraRig, impactKick, impactShake } from "./camera";
import { fireInstanceAttrs, makeFireMaterial, makeVfxUnlit } from "./fire-mat";

const LIGHT_POOL = 4;
const DECAL_MAX = 256;
const RIBBON_MAX_VERTS = 512;
const ARC_MAX = 24;

export interface VfxSystem {
  present(
    snapshot: SimSnapshot,
    dt: number,
    cube: { x: number; y: number; z: number },
    reduced: boolean,
  ): void;
  dispose(): void;
}

function flicker(t: number, reduced: boolean): number {
  if (reduced) return 1;
  return 0.82 + 0.06 * (Math.sin(t * 29) + Math.sin(t * 47) + Math.sin(t * 11));
}

function chatter(t: number, reduced: boolean): number {
  if (reduced) return 1;
  return 0.78 + 0.22 * Math.sin(t * 180 * Math.PI * 2);
}

function fillRibbon(
  pos: Float32Array,
  along: Float32Array,
  pts: Float32Array,
  count: number,
  width: number,
  _groundY: number,
): number {
  let w = 0;
  for (let i = 0; i < count - 1; i++) {
    const ax = pts[i * 3] ?? 0;
    const ay = pts[i * 3 + 1] ?? 0;
    const az = pts[i * 3 + 2] ?? 0;
    const bx = pts[(i + 1) * 3] ?? 0;
    const by = pts[(i + 1) * 3 + 1] ?? 0;
    const bz = pts[(i + 1) * 3 + 2] ?? 0;
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const sx = len > 1e-6 ? (-dz / len) * width : width;
    const sz = len > 1e-6 ? (dx / len) * width : 0;
    const t0 = i / (count - 1);
    const t1 = (i + 1) / (count - 1);
    const o = w * 3;
    pos[o] = ax + sx;
    pos[o + 1] = ay;
    pos[o + 2] = az + sz;
    pos[o + 3] = ax - sx;
    pos[o + 4] = ay;
    pos[o + 5] = az - sz;
    pos[o + 6] = bx + sx;
    pos[o + 7] = by;
    pos[o + 8] = bz + sz;
    pos[o + 9] = bx - sx;
    pos[o + 10] = by;
    pos[o + 11] = bz - sz;
    along[w] = t0;
    along[w + 1] = t0;
    along[w + 2] = t1;
    along[w + 3] = t1;
    w += 4;
    if (w + 4 > RIBBON_MAX_VERTS) break;
  }
  return w;
}

function ribbonIndex(maxVerts: number): Uint16Array {
  const quads = (maxVerts / 4) | 0;
  const idx = new Uint16Array(quads * 6);
  for (let q = 0; q < quads; q++) {
    const b = q * 4;
    const o = q * 6;
    idx[o] = b;
    idx[o + 1] = b + 1;
    idx[o + 2] = b + 2;
    idx[o + 3] = b + 1;
    idx[o + 4] = b + 3;
    idx[o + 5] = b + 2;
  }
  return idx;
}

export function createVfx(scene: Scene, rig: CameraRig): VfxSystem {
  const dummy = new Object3D();
  const fireMat = makeFireMaterial();
  const fireGeo = new PlaneGeometry(1, 1);
  const attrs = fireInstanceAttrs(FIRE_MAX);
  fireGeo.setAttribute("aT", attrs.t);
  fireGeo.setAttribute("aA", attrs.a);
  fireGeo.setAttribute("aSeed", attrs.seed);
  const fireMesh = new InstancedMesh(fireGeo, fireMat, FIRE_MAX);
  fireMesh.frustumCulled = false;
  fireMesh.renderOrder = 5;
  fireMesh.count = 0;
  fireMesh.castShadow = false;
  fireMesh.receiveShadow = false;
  scene.add(fireMesh);

  const decalMat = makeVfxUnlit(0x2a221c, 0.55);
  const decalMesh = new InstancedMesh(new PlaneGeometry(1.6, 1.6), decalMat, DECAL_MAX);
  decalMesh.frustumCulled = false;
  decalMesh.renderOrder = 1;
  decalMesh.count = 0;
  scene.add(decalMesh);

  const iceMat = makeVfxUnlit(0x1aa7c4, 0.42);
  const iceMesh = new InstancedMesh(new PlaneGeometry(1.15, 1.15), iceMat, ICE_MAX);
  iceMesh.frustumCulled = false;
  iceMesh.renderOrder = 1;
  iceMesh.count = 0;
  scene.add(iceMesh);

  const ionMat = makeVfxUnlit(0x3b46e0, 0.45);
  const ionMesh = new Mesh(new PlaneGeometry(2.8, 2.8), ionMat);
  ionMesh.rotation.x = -Math.PI / 2;
  ionMesh.visible = false;
  ionMesh.renderOrder = 2;
  scene.add(ionMesh);

  const craterMat = makeVfxUnlit(0x3a3a44, 0.5);
  const craterMesh = new Mesh(new PlaneGeometry(3.2, 3.2), craterMat);
  craterMesh.rotation.x = -Math.PI / 2;
  craterMesh.visible = false;
  craterMesh.renderOrder = 2;
  scene.add(craterMesh);

  const coreMat = makeVfxUnlit(0xe8ecff, 1);
  const haloMat = makeVfxUnlit(0x3b46e0, 0.7);
  const coreGeo = new BufferGeometry();
  const haloGeo = new BufferGeometry();
  const corePos = new Float32Array(RIBBON_MAX_VERTS * 3);
  const haloPos = new Float32Array(RIBBON_MAX_VERTS * 3);
  const coreAlong = new Float32Array(RIBBON_MAX_VERTS);
  const haloAlong = new Float32Array(RIBBON_MAX_VERTS);
  coreGeo.setAttribute("position", new BufferAttribute(corePos, 3).setUsage(DynamicDrawUsage));
  haloGeo.setAttribute("position", new BufferAttribute(haloPos, 3).setUsage(DynamicDrawUsage));
  coreGeo.setAttribute("aAlong", new BufferAttribute(coreAlong, 1).setUsage(DynamicDrawUsage));
  haloGeo.setAttribute("aAlong", new BufferAttribute(haloAlong, 1).setUsage(DynamicDrawUsage));
  coreGeo.setIndex(new BufferAttribute(ribbonIndex(RIBBON_MAX_VERTS), 1));
  haloGeo.setIndex(new BufferAttribute(ribbonIndex(RIBBON_MAX_VERTS), 1));
  const coreMesh = new Mesh(coreGeo, coreMat);
  const haloMesh = new Mesh(haloGeo, haloMat);
  coreMesh.frustumCulled = false;
  haloMesh.frustumCulled = false;
  coreMesh.visible = false;
  haloMesh.visible = false;
  coreMesh.renderOrder = 6;
  haloMesh.renderOrder = 4;
  scene.add(haloMesh);
  scene.add(coreMesh);

  const spreadMat = makeVfxUnlit(0x6e7cff, 0.55);
  const spreadMesh = new InstancedMesh(new PlaneGeometry(0.7, 0.08), spreadMat, ARC_MAX);
  spreadMesh.frustumCulled = false;
  spreadMesh.count = 0;
  spreadMesh.renderOrder = 3;
  scene.add(spreadMesh);

  const lights: PointLight[] = [];
  const lightLife = new Float32Array(LIGHT_POOL);
  for (let i = 0; i < LIGHT_POOL; i++) {
    const light = new PointLight(0xff7a2a, 0, 8, 2);
    light.visible = false;
    scene.add(light);
    lights.push(light);
    lightLife[i] = 0;
  }

  const bolt = generateBolt(1, 0, 0, 0);
  let boltLive = false;
  let boltT = 0;
  let boltReveal = 0;
  let restrikes = 0;
  let nextRestrike = 0;
  let boltX = 0;
  let boltZ = 0;
  let boltGround = 0;
  let boltSeed = 0;
  let spreadT = -1;
  let ionT = 0;
  let craterT = 0;
  let clock = 0;
  let lastPulseTick = -1;

  const paintBolt = (seed: number, x: number, z: number, groundY: number) => {
    generateBolt(seed, x, z, groundY, bolt);
    const cw = fillRibbon(corePos, coreAlong, bolt.main, bolt.mainCount, 0.045, groundY);
    const hw = fillRibbon(haloPos, haloAlong, bolt.main, bolt.mainCount, 0.16, groundY);
    coreGeo.setDrawRange(0, (cw / 4) * 6);
    haloGeo.setDrawRange(0, (hw / 4) * 6);
    const cp = coreGeo.getAttribute("position");
    const hp = haloGeo.getAttribute("position");
    if (cp) cp.needsUpdate = true;
    if (hp) hp.needsUpdate = true;
    coreGeo.computeBoundingSphere();
    haloGeo.computeBoundingSphere();
  };

  const strike = (seed: number, x: number, z: number, groundY: number) => {
    boltSeed = seed;
    boltX = x;
    boltZ = z;
    boltGround = groundY;
    paintBolt(seed, x, z, groundY);
    boltLive = true;
    boltT = 0;
    boltReveal = 0;
    restrikes = 2;
    nextRestrike = 0.12;
    spreadT = 0;
    ionT = 1.6;
    ionMesh.position.set(x, groundY + 0.03, z);
    ionMesh.visible = true;
    const strobe = lights[1];
    if (strobe) {
      strobe.color.setHex(0x8f9bff);
      strobe.intensity = 7.5;
      strobe.distance = 10;
      strobe.position.set(x, groundY + 1.2, z);
      strobe.visible = true;
      lightLife[1] = 0.45;
    }
  };

  return {
    present(snapshot, dt, cube, reduced) {
      clock += dt;
      const v = snapshot.vfx;
      if (v.pulse !== 0 && snapshot.tick !== lastPulseTick) {
        lastPulseTick = snapshot.tick;
        if (v.pulse === VFX_PULSE_FIRE) {
          impactShake(rig, SHAKE_FIRE); // impact: fire
          const light = lights[0];
          if (light) {
            light.color.setHex(0xff7a2a);
            light.intensity = 3.6;
            light.distance = 7;
            light.position.set(cube.x, cube.y + 0.4, cube.z);
            light.visible = true;
            lightLife[0] = 0.85;
          }
        } else if (v.pulse === VFX_PULSE_BOLT) {
          impactShake(rig, SHAKE_BOLT); // impact: lightning
          strike(v.boltSeed, cube.x, cube.z, v.groundH + 0.05);
        } else if (v.pulse === VFX_PULSE_PHYS) {
          impactShake(rig, SHAKE_PHYS); // impact: physical
          impactKick(rig, CAM_KICK_PHYS);
          craterT = 1.4;
          craterMesh.position.set(cube.x, v.groundH + 0.025, cube.z);
          craterMesh.visible = true;
          const thump = lights[2];
          if (thump) {
            thump.color.setHex(0xcfc8bd);
            thump.intensity = 1.6;
            thump.distance = 6;
            thump.position.set(cube.x, cube.y, cube.z);
            thump.visible = true;
            lightLife[2] = 0.3;
          }
        } else if (v.pulse === VFX_PULSE_ICE) {
          impactShake(rig, SHAKE_ICE); // impact: ice
          const chill = lights[3];
          if (chill) {
            chill.color.setHex(0x1aa7c4);
            chill.intensity = 2.4;
            chill.distance = 6;
            chill.position.set(cube.x, cube.y + 0.35, cube.z);
            chill.visible = true;
            lightLife[3] = 0.55;
          }
        }
      }

      const n = v.fireCount < FIRE_MAX ? v.fireCount : FIRE_MAX;
      const tArr = attrs.t.array as Float32Array;
      const aArr = attrs.a.array as Float32Array;
      const sArr = attrs.seed.array as Float32Array;
      for (let i = 0; i < n; i++) {
        dummy.position.set(v.fireX[i] ?? 0, v.fireY[i] ?? 0, v.fireZ[i] ?? 0);
        const size = v.fireSize[i] ?? 0.3;
        dummy.scale.set(size * (v.fireStretch[i] ?? 1), size, 1);
        dummy.lookAt(rig.position.x, rig.position.y, rig.position.z);
        dummy.updateMatrix();
        fireMesh.setMatrixAt(i, dummy.matrix);
        tArr[i] = v.fireT[i] ?? 0;
        aArr[i] = v.fireA[i] ?? 0;
        sArr[i] = v.fireSeed[i] ?? 0;
      }
      fireMesh.count = n;
      fireMesh.instanceMatrix.needsUpdate = true;
      attrs.t.needsUpdate = true;
      attrs.a.needsUpdate = true;
      attrs.seed.needsUpdate = true;
      fireMesh.visible = n > 0;

      const scorchN = v.scorchCount < DECAL_MAX ? v.scorchCount : DECAL_MAX;
      for (let i = 0; i < scorchN; i++) {
        const cell = unpackXZ(v.scorch[i] ?? 0);
        dummy.position.set(cell.x, (v.scorchH[i] ?? 0) + 0.02, cell.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        decalMesh.setMatrixAt(i, dummy.matrix);
      }
      decalMesh.count = scorchN;
      decalMesh.instanceMatrix.needsUpdate = true;

      const iceN = v.iceCount < ICE_MAX ? v.iceCount : ICE_MAX;
      for (let i = 0; i < iceN; i++) {
        const cell = unpackXZ(v.ice[i] ?? 0);
        dummy.position.set(cell.x, (v.iceH[i] ?? 0) + 0.018, cell.z);
        dummy.scale.set(1, 1, 1);
        dummy.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
        dummy.updateMatrix();
        iceMesh.setMatrixAt(i, dummy.matrix);
      }
      iceMesh.count = iceN;
      iceMesh.instanceMatrix.needsUpdate = true;

      const bi = burnIntensity(v.burnT, v.burnDur);
      const fireLight = lights[0];
      if (fireLight) {
        if (bi > 0.02) {
          fireLight.color.setHex(0xff7a2a);
          fireLight.intensity = 2.4 * bi * flicker(clock, reduced);
          fireLight.position.set(cube.x, cube.y + 0.55, cube.z);
          fireLight.visible = true;
          fireLight.distance = 7;
        } else if ((lightLife[0] ?? 0) <= 0) {
          fireLight.visible = false;
        }
      }

      if (boltLive) {
        boltT += dt;
        boltReveal += dt;
        if (restrikes > 0 && boltT >= nextRestrike) {
          paintBolt(boltSeed + (3 - restrikes), boltX, boltZ, boltGround);
          restrikes -= 1;
          nextRestrike += 0.12;
          boltReveal = 0;
        }
        const k = boltT / 0.5;
        if (k >= 1) {
          boltLive = false;
          coreMesh.visible = false;
          haloMesh.visible = false;
        } else {
          const env = (1 - k) * (1 - k);
          const reveal = boltReveal / 0.015 < 1 ? boltReveal / 0.015 : 1;
          const ch = chatter(clock, reduced);
          coreMat.opacity = env * ch * reveal;
          haloMat.opacity = env * 0.7 * ch * reveal;
          coreMesh.visible = true;
          haloMesh.visible = true;
        }
      }

      if (spreadT >= 0) {
        spreadT += dt;
        const k = spreadT / SPREAD_DUR;
        if (k >= 1) {
          spreadT = -1;
          spreadMesh.count = 0;
        } else {
          const front = SPREAD_R * (1 - (1 - k) * (1 - k));
          const arcs = reduced ? 6 : ARC_MAX;
          for (let i = 0; i < arcs; i++) {
            const ang = (i / arcs) * Math.PI * 2 + clock * 0.4;
            dummy.position.set(
              boltX + Math.cos(ang) * front,
              boltGround + 0.04,
              boltZ + Math.sin(ang) * front,
            );
            dummy.rotation.set(0, -ang, 0);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            spreadMesh.setMatrixAt(i, dummy.matrix);
          }
          spreadMesh.count = arcs;
          spreadMesh.instanceMatrix.needsUpdate = true;
        }
      }

      if (ionT > 0) {
        ionT -= dt;
        ionMat.opacity = Math.max(0, ionT / 1.6) * 0.45;
        ionMesh.visible = ionT > 0;
      }
      if (craterT > 0) {
        craterT -= dt;
        craterMat.opacity = Math.max(0, craterT / 1.4) * 0.5;
        craterMesh.visible = craterT > 0;
      }

      for (let i = 0; i < LIGHT_POOL; i++) {
        const life = lightLife[i] ?? 0;
        const light = lights[i];
        if (!light || life <= 0) continue;
        const next = life - dt;
        lightLife[i] = next;
        if (next <= 0) {
          light.visible = false;
          light.intensity = 0;
        } else if (i !== 0) {
          light.intensity *= 0.92;
        }
      }
    },
    dispose() {
      fireMesh.removeFromParent();
      decalMesh.removeFromParent();
      iceMesh.removeFromParent();
      ionMesh.removeFromParent();
      craterMesh.removeFromParent();
      coreMesh.removeFromParent();
      haloMesh.removeFromParent();
      spreadMesh.removeFromParent();
      for (const light of lights) light.removeFromParent();
      fireGeo.dispose();
      fireMat.dispose();
      decalMat.dispose();
      iceMat.dispose();
      ionMat.dispose();
      craterMat.dispose();
      coreMat.dispose();
      haloMat.dispose();
      spreadMat.dispose();
    },
  };
}

/** Readability: reduced motion keeps the channel opaque enough to read. */
export function boltReadable(reduced: boolean, env: number): boolean {
  const ch = chatter(0, reduced);
  return env * ch > 0.2;
}
