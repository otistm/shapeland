import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import {
  bindKeyboard,
  loadLoadoutJson,
  nowSeconds,
  probeCapabilities,
  saveLoadoutJson,
} from "@shapeland/platform";
import { createGamePresenter } from "@shapeland/render/presenter";
import {
  ABILITY_FIRE,
  ABILITY_LIGHTNING,
  ABILITY_PHYSICAL,
  SimLoop,
  copySnapshot,
  parseLoadout,
  serializeLoadout,
} from "@shapeland/sim";
import { bakeAbilityCanvases, mountHud } from "@shapeland/ui";

const seed = 1;
const contentHash = hashContent(EMPTY_CONTENT);
const sim = new SimLoop({ seed, contentHash });

const saved = loadLoadoutJson();
if (saved) {
  try {
    const parsed = parseLoadout(JSON.parse(saved) as unknown);
    sim.world.applyLoadout(parsed.found, parsed.faces);
  } catch {
    sim.world.grant(ABILITY_FIRE);
    sim.world.grant(ABILITY_LIGHTNING);
    sim.world.grant(ABILITY_PHYSICAL);
  }
} else {
  sim.world.grant(ABILITY_FIRE);
  sim.world.grant(ABILITY_LIGHTNING);
  sim.world.grant(ABILITY_PHYSICAL);
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

let modal = false;
const hud = mountHud(hudHost, {
  canvases,
  onModal: (open) => {
    modal = open;
    if (open) sim.hold(0);
  },
  onCommit: (faces) => {
    const ok = sim.world.commitFaces(faces);
    if (ok) {
      sim.world.capture(sim.cur);
      saveLoadoutJson(JSON.stringify(serializeLoadout(sim.world.faces, sim.world.found)));
    }
    return ok;
  },
});

const boot = async () => {
  const presenter = await createGamePresenter(canvas, { forceWebGL, faceCanvases: canvases });
  canvas.dataset.backend = presenter.backend;
  hudHost.dataset.webgpu = presenter.backend === "webgpu" ? "1" : "0";
  hud.render(sim.cur, 0, presenter.backend);

  const resize = () => {
    presenter.resize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener("resize", resize);

  bindKeyboard(window, (mask) => {
    if (!modal) sim.hold(mask);
  });

  let last = nowSeconds();
  const frame = (nowMs: number) => {
    const now = nowMs / 1000;
    const dt = now - last;
    last = now;
    sim.frame(dt);
    presenter.present(sim.prev, sim.cur, sim.alpha, dt);
    hud.render(sim.cur, sim.alpha, presenter.backend);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};

void boot();
