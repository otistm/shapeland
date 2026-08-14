import { PAD_CONNECTED, PAD_DISCONNECTED, SLICE_CONTENT, hashContent } from "@shapeland/content";
import {
  bindCanvasJump,
  bindHoldButton,
  bindKeyboard,
  bindTouchStick,
  createPadPoller,
  loadLoadoutJson,
  nowSeconds,
  probeCapabilities,
  routePad,
  saveLoadoutJson,
} from "@shapeland/platform";
import { createGamePresenter } from "@shapeland/render/presenter";
import {
  BUTTON_JUMP,
  BUTTON_PIVOT,
  SimLoop,
  copySnapshot,
  mergeInputMasks,
  parseLoadout,
  rotateDirMask,
  serializeLoadout,
} from "@shapeland/sim";
import { bakeAbilityCanvases, mountHud } from "@shapeland/ui";

const seed = 1;
const contentHash = hashContent(SLICE_CONTENT);
const sim = new SimLoop({ seed, contentHash, slice: true });

const saved = loadLoadoutJson();
if (saved) {
  try {
    const parsed = parseLoadout(JSON.parse(saved) as unknown);
    sim.world.applyLoadout(parsed.found, parsed.faces);
  } catch {
    /* found-gating: a corrupt save starts blank */
  }
}
sim.world.capture(sim.cur);
copySnapshot(sim.cur, sim.prev);

const caps = probeCapabilities();
const forceWebGL = new URLSearchParams(location.search).has("gl") || !caps.webgpu;
const canvases = bakeAbilityCanvases();

const canvas = document.querySelector("#view");
const hudHost = document.querySelector("#hud");
if (!(canvas instanceof HTMLCanvasElement) || !(hudHost instanceof HTMLElement)) {
  throw new Error("missing #view or #hud");
}

let keyMask = 0;
let touchDir = 0;
let touchPivot = 0;
let touchJump = 0;
let padMask = 0;
let padWas = false;
let camYaw = 0;
let applyMask = (): void => {
  sim.hold(0);
};
let clearStick = (): void => {};
let turnCamera = (_delta: 1 | -1): void => {};

const hud = mountHud(hudHost, {
  canvases,
  onModal: (open) => {
    if (open) {
      sim.hold(0);
      touchDir = 0;
      touchPivot = 0;
      touchJump = 0;
      clearStick();
    } else applyMask();
  },
  onCommit: (faces) => {
    const ok = sim.world.commitFaces(faces);
    if (ok) {
      sim.world.capture(sim.cur);
      saveLoadoutJson(JSON.stringify(serializeLoadout(sim.world.faces, sim.world.found)));
    }
    return ok;
  },
  onCam: (delta) => {
    turnCamera(delta);
  },
});

applyMask = () => {
  if (hud.modalOpen()) {
    sim.hold(0);
    return;
  }
  const merged = mergeInputMasks(keyMask, touchDir | touchPivot | touchJump, padMask);
  sim.hold(rotateDirMask(merged, camYaw));
};

const stickEl = hudHost.querySelector("#stick");
const knobEl = hudHost.querySelector("#knob");
const pivotEl = hudHost.querySelector("#pivot");
if (
  !(stickEl instanceof HTMLElement) ||
  !(knobEl instanceof HTMLElement) ||
  !(pivotEl instanceof HTMLElement)
) {
  throw new Error("missing touch controls");
}

const stick = bindTouchStick(
  stickEl,
  knobEl,
  (mask) => {
    touchDir = mask;
    applyMask();
  },
  () => hud.modalOpen() || padWas,
);
clearStick = () => stick.clear();
bindHoldButton(
  pivotEl,
  (down) => {
    touchPivot = down ? BUTTON_PIVOT : 0;
    applyMask();
  },
  () => hud.modalOpen() || padWas,
);
bindCanvasJump(
  canvas,
  (down) => {
    touchJump = down ? BUTTON_JUMP : 0;
    applyMask();
  },
  () => hud.modalOpen(),
);

const pad = createPadPoller();

const boot = async () => {
  const presenter = await createGamePresenter(canvas, {
    forceWebGL,
    faceCanvases: canvases,
    terrain: sim.world.terrain,
  });
  canvas.dataset.backend = presenter.backend;
  hudHost.dataset.webgpu = presenter.backend === "webgpu" ? "1" : "0";
  hud.render(sim.cur, 0, presenter.backend);

  turnCamera = (delta) => {
    if (hud.modalOpen()) return;
    presenter.turnCamera(delta);
    camYaw = presenter.yaw;
    applyMask();
  };

  const resize = () => {
    presenter.resize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener("resize", resize);

  bindKeyboard(
    window,
    (mask) => {
      keyMask = mask;
      applyMask();
    },
    (delta) => turnCamera(delta),
  );

  let last = nowSeconds();
  const frame = (nowMs: number) => {
    const now = nowMs / 1000;
    const dt = now - last;
    last = now;

    const sample = pad.poll();
    if (sample.connected !== padWas) {
      padWas = sample.connected;
      document.body.classList.toggle("pad", sample.connected);
      hud.setPadConnected(sample.connected);
      hud.announce(sample.connected ? PAD_CONNECTED : PAD_DISCONNECTED);
      if (sample.connected) stick.clear();
    }
    const routed = routePad(sample, hud.dialogIsOpen(), hud.equipIsOpen());
    if (routed.route === "confirm") hud.advanceDialog();
    else if (routed.route === "speak") hud.trySpeak();
    else if (routed.route === "open-equip") hud.openEquip();
    else if (routed.route === "close-equip") hud.commitEquip();
    if (sample.risingCamCw) turnCamera(1);
    if (sample.risingCamCcw) turnCamera(-1);
    padMask = routed.mask;
    applyMask();

    sim.frame(dt);
    presenter.present(sim.prev, sim.cur, sim.alpha, dt);
    hud.render(sim.cur, sim.alpha, presenter.backend);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

void boot();
