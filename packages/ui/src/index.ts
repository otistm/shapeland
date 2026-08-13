import { CUBE_BODY, INTEGRITY, type SimSnapshot, hex32 } from "@shapeland/sim";

export interface HudHandle {
  render(snapshot: SimSnapshot, alpha: number, backend?: string): void;
  dispose(): void;
}

export function mountHud(host: HTMLElement): HudHandle {
  host.replaceChildren();
  const root = document.createElement("div");
  root.dataset.hud = "shell";
  root.style.cssText = [
    "font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    "color: #1a1a1a",
    "padding: 16px",
    "pointer-events: none",
  ].join(";");

  const pips = document.createElement("div");
  pips.id = "pips";
  pips.style.cssText = "display:flex;gap:5px;margin:8px 0 12px";
  for (let i = 0; i < INTEGRITY; i++) {
    const pip = document.createElement("i");
    pip.style.cssText = `width:9px;height:9px;border:1.5px solid #1a1a1a;border-radius:2px;background:${CUBE_BODY};display:block`;
    pips.appendChild(pip);
  }

  const log = document.createElement("pre");
  log.style.cssText = "margin:0;white-space:pre";

  root.appendChild(pips);
  root.appendChild(log);
  host.appendChild(root);

  return {
    render(snapshot, alpha, backend) {
      const pipsList = pips.children;
      for (let i = 0; i < pipsList.length; i++) {
        const el = pipsList[i] as HTMLElement;
        el.style.background = i < snapshot.integrity ? CUBE_BODY : "transparent";
      }
      log.textContent = [
        "SHAPELAND  ·  phase 1",
        backend ? `backend       ${backend}` : "",
        `tick           ${snapshot.tick}`,
        `alpha          ${alpha.toFixed(3)}`,
        `cell           ${snapshot.player.x},${snapshot.player.y},${snapshot.player.z}  ori ${snapshot.player.orientation}`,
        `hash           ${hex32(snapshot.hashes.total)}`,
      ]
        .filter((line) => line !== "")
        .join("\n");
    },
    dispose() {
      host.replaceChildren();
    },
  };
}
