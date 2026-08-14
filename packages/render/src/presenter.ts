import { type AbilityKind, kindOf } from "@shapeland/content";
import {
  CAM_FOV,
  FLOOR_SIZE,
  FOG_COLOR,
  FOG_FAR,
  FOG_NEAR,
  GRID_MAJOR,
  GRID_MINOR,
  GRID_PERIOD,
  HEMI_GROUND,
  HEMI_INTENSITY,
  HEMI_SKY,
  KEY_LIGHT,
  SHADOW_BIAS,
  SHADOW_EXTENT,
  SHADOW_FAR,
  SHADOW_RADIUS,
  SUN_COLOR,
  SUN_INTENSITY,
  type SimSnapshot,
  type Terrain,
} from "@shapeland/sim";
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  type OrthographicCamera,
  PerspectiveCamera,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  Scene,
  WebGPURenderer,
} from "three/webgpu";
import { clearCameraFeel, createCameraRig, lookAtY, stepCamera } from "./camera";
import { bakeFaceTextures } from "./faces";
import { toNonIndexedFacets } from "./geometry";
import { type InterpolatedFrame, interpolate } from "./interpolate";
import { SIM_FACE_FOR_GROUP } from "./orientation-map";
import { createSquash, stepSquash } from "./squash";
import { makeToon } from "./toon";
import { createVfx } from "./vfx";
import { createWorldView } from "./world-view";

export type RenderBackend = "webgpu" | "webgl2";

export interface GamePresenter {
  backend: RenderBackend;
  present(prev: SimSnapshot, cur: SimSnapshot, alpha: number, dt: number): InterpolatedFrame;
  resize(width: number, height: number): void;
  dispose(): void;
}

function gridCanvas(): HTMLCanvasElement {
  const px = 128;
  const size = px * GRID_PERIOD;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2d canvas unavailable for grid bake");
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, size, size);
  g.lineCap = "butt";
  for (let i = 0; i < GRID_PERIOD; i++) {
    const at = (i + 0.5) * px;
    const major = i === 0;
    g.strokeStyle = major ? GRID_MAJOR : GRID_MINOR;
    g.lineWidth = major ? 6 : 3.5;
    g.beginPath();
    g.moveTo(at, 0);
    g.lineTo(at, size);
    g.stroke();
    g.beginPath();
    g.moveTo(0, at);
    g.lineTo(size, at);
    g.stroke();
  }
  return canvas;
}

export async function createGamePresenter(
  canvas: HTMLCanvasElement,
  opts: {
    forceWebGL?: boolean;
    faceCanvases?: Record<AbilityKind, HTMLCanvasElement>;
    terrain?: Terrain;
  } = {},
): Promise<GamePresenter> {
  const forceWebGL =
    opts.forceWebGL === true || !(typeof navigator !== "undefined" && "gpu" in navigator);
  const renderer = new WebGPURenderer({
    canvas,
    antialias: true,
    forceWebGL,
    alpha: false,
  });
  await renderer.init();
  renderer.setClearColor(new Color(0xffffff), 1);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const backend: RenderBackend =
    renderer.backend && (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend
      ? "webgpu"
      : "webgl2";

  const scene = new Scene();
  scene.background = new Color(0xffffff);
  scene.fog = new Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

  const camera = new PerspectiveCamera(CAM_FOV, 1, 0.1, 200);
  const rig = createCameraRig();
  const camReady = { current: false };

  scene.add(new HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY));
  const sun = new DirectionalLight(SUN_COLOR, SUN_INTENSITY);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = SHADOW_RADIUS;
  sun.shadow.bias = SHADOW_BIAS;
  const shadowCam = sun.shadow.camera as OrthographicCamera;
  shadowCam.left = -SHADOW_EXTENT;
  shadowCam.right = SHADOW_EXTENT;
  shadowCam.top = SHADOW_EXTENT;
  shadowCam.bottom = -SHADOW_EXTENT;
  shadowCam.near = 1;
  shadowCam.far = SHADOW_FAR;
  scene.add(sun);
  scene.add(sun.target);

  const gridTex = new CanvasTexture(gridCanvas());
  gridTex.wrapS = RepeatWrapping;
  gridTex.wrapT = RepeatWrapping;
  gridTex.repeat.set(FLOOR_SIZE / GRID_PERIOD, FLOOR_SIZE / GRID_PERIOD);
  gridTex.colorSpace = SRGBColorSpace;
  const ground = new Mesh(new PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE), makeToon({ map: gridTex }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.castShadow = false;
  scene.add(ground);

  const faceTex = bakeFaceTextures(opts.faceCanvases);
  const cubeMats = SIM_FACE_FOR_GROUP.map(() => makeToon({ map: faceTex.normal, color: 0xffffff }));
  const cube = new Mesh(toNonIndexedFacets(new BoxGeometry(1, 1, 1)), cubeMats);
  cube.castShadow = true;
  cube.receiveShadow = false;
  const cubeRig = new Group();
  cubeRig.add(cube);
  scene.add(cubeRig);
  const squash = createSquash();
  let paintedFaces = -1;
  const vfx = createVfx(scene, rig);
  const worldView = opts.terrain ? createWorldView(scene, opts.terrain, faceTex) : null;
  const terrain = opts.terrain;
  const heightAt = terrain
    ? (x: number, z: number) => {
        const ground = terrain.height(x, z);
        const pier = terrain.wallHeight(x, z);
        return pier > ground ? pier : ground;
      }
    : undefined;
  let worldClock = 0;
  const reducedMotion = (): boolean =>
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const resize = (width: number, height: number) => {
    const w = Math.max(1, width);
    const h = Math.max(1, height);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  };
  resize(canvas.clientWidth || canvas.width, canvas.clientHeight || canvas.height);

  return {
    backend,
    present(prev, cur, alpha, dt) {
      const frame = interpolate(prev, cur, alpha);
      stepCamera(
        rig,
        {
          followX: frame.camera.followX,
          followZ: frame.camera.followZ,
          restY: frame.camera.restY,
          aimX: frame.camera.aimX,
          aimZ: frame.camera.aimZ,
          dt,
          heightAt,
        },
        camReady,
      );

      const { sy, sxz } = stepSquash(
        squash,
        cur.move.mode,
        cur.move.phase,
        cur.move.flags,
        cur.move.vy,
        dt,
      );
      const height = Math.max(0, frame.player.y - 0.5);
      const kAnchor = Math.min(1, height / 0.45);
      cubeRig.position.set(
        frame.player.x,
        frame.player.y * (kAnchor + (1 - kAnchor) * sy),
        frame.player.z,
      );
      cubeRig.scale.set(sxz, sy, sxz);
      cube.quaternion.set(frame.player.qx, frame.player.qy, frame.player.qz, frame.player.qw);

      let faceKey = cur.player.found;
      for (let i = 0; i < 6; i++) faceKey = (faceKey << 3) | (cur.player.faces[i] ?? 0);
      if (faceKey !== paintedFaces) {
        paintedFaces = faceKey;
        for (let g = 0; g < 6; g++) {
          const simFace = SIM_FACE_FOR_GROUP[g] ?? 0;
          const kind = kindOf(cur.player.faces[simFace] ?? 0);
          const mat = cubeMats[g];
          const tex = faceTex[kind];
          if (mat && tex) mat.map = tex;
        }
      }

      sun.position.set(
        frame.camera.followX + KEY_LIGHT[0],
        KEY_LIGHT[1],
        frame.camera.followZ + KEY_LIGHT[2],
      );
      sun.target.position.set(frame.camera.followX, frame.camera.restY, frame.camera.followZ);
      sun.target.updateMatrixWorld();
      ground.position.x = Math.round(frame.camera.followX / GRID_PERIOD) * GRID_PERIOD;
      ground.position.z = Math.round(frame.camera.followZ / GRID_PERIOD) * GRID_PERIOD;

      const reduced = reducedMotion();
      vfx.present(
        cur,
        dt,
        { x: cubeRig.position.x, y: cubeRig.position.y, z: cubeRig.position.z },
        reduced,
      );
      worldClock += dt;
      worldView?.present(cur, dt, worldClock, rig, reduced);

      if (reduced) clearCameraFeel(rig);
      camera.position.set(rig.position.x, rig.position.y + rig.kickY, rig.position.z);
      const shake = rig.shake;
      if (shake > 0) {
        camera.position.x += (Math.random() - 0.5) * shake;
        camera.position.y += (Math.random() - 0.5) * shake;
        camera.position.z += (Math.random() - 0.5) * shake;
      }
      camera.lookAt(rig.target.x, lookAtY(rig), rig.target.z);

      renderer.render(scene, camera);
      return frame;
    },
    resize,
    dispose() {
      vfx.dispose();
      worldView?.dispose();
      renderer.dispose();
    },
  };
}
