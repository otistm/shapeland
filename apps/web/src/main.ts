import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { bindKeyboard, nowSeconds, probeCapabilities } from "@shapeland/platform";
import { createGamePresenter } from "@shapeland/render/presenter";
import { SimLoop } from "@shapeland/sim";
import { mountHud } from "@shapeland/ui";

const seed = 1;
const contentHash = hashContent(EMPTY_CONTENT);
const sim = new SimLoop({ seed, contentHash });
const caps = probeCapabilities();
const forceWebGL = new URLSearchParams(location.search).has("gl") || !caps.webgpu;

const canvas = document.querySelector("#view");
const hudHost = document.querySelector("#hud");
if (!(canvas instanceof HTMLCanvasElement) || !(hudHost instanceof HTMLElement)) {
  throw new Error("missing #view or #hud");
}

const hud = mountHud(hudHost);

const boot = async () => {
  const presenter = await createGamePresenter(canvas, { forceWebGL });
  canvas.dataset.backend = presenter.backend;
  hudHost.dataset.webgpu = presenter.backend === "webgpu" ? "1" : "0";
  hud.render(sim.cur, 0, presenter.backend);

  const resize = () => {
    presenter.resize(window.innerWidth, window.innerHeight);
  };
  resize();
  window.addEventListener("resize", resize);

  bindKeyboard(window, (mask) => sim.hold(mask));

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
