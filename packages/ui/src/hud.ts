import {
  ABILITY_CSS,
  ABILITY_LABEL,
  ABILITY_LINE,
  AIM_HINT,
  type AbilityKind,
  BANNER_TEXT,
  DIALOG_CUE_PAD,
  DIALOG_CUE_TOUCH,
  NPC_LINES,
  NPC_NAME,
  REGION_NAME,
  STAGE_HINT,
  kindOf,
} from "@shapeland/content";
import {
  ABILITY_MAX,
  ABILITY_NORMAL,
  CUBE_BODY,
  DOWN,
  INTEGRITY,
  type SimSnapshot,
  UP,
  abilityFound,
  armedCount,
  axisClash,
  hex32,
  nearestPlace,
} from "@shapeland/sim";
import type { AbilityCanvases } from "./canvases";
import { abilityUrls } from "./canvases";
import {
  DRAG_SLOP,
  type DragState,
  FACE_BODY_LABEL,
  NET_CELLS,
  cloneFaces,
  dropOffNet,
  dropOn,
  pastSlop,
  tapPlace,
  toggleChip,
} from "./equip-net";

export interface HudHandle {
  render(snapshot: SimSnapshot, alpha: number, backend?: string): void;
  dispose(): void;
  setPadConnected(connected: boolean): void;
  announce(text: string, ms?: number): void;
  trySpeak(): void;
  openEquip(): void;
  commitEquip(): void;
  advanceDialog(): void;
  modalOpen(): boolean;
  dialogIsOpen(): boolean;
  equipIsOpen(): boolean;
}

export interface HudOptions {
  canvases: AbilityCanvases;
  onModal?: (open: boolean) => void;
  onCommit?: (faces: number[]) => boolean;
}

export function mountHud(host: HTMLElement, opts: HudOptions): HudHandle {
  host.replaceChildren();
  const urls = abilityUrls(opts.canvases);
  const root = document.createElement("div");
  root.dataset.hud = "shell";

  const armed = document.createElement("div");
  armed.id = "armed";
  armed.innerHTML =
    `<div class="eyebrow">Face up</div>` +
    `<div class="row"><span class="swatch" id="sw"></span><span class="name" id="nm">Normal</span></div>` +
    `<div class="sub" id="sb"></div>` +
    `<div class="under" id="underEl">UNDER · NORMAL</div>` +
    `<div id="pips"></div>` +
    `<pre id="dbg"></pre>`;
  const pips = armed.querySelector("#pips");
  if (pips) {
    for (let i = 0; i < INTEGRITY; i++) pips.appendChild(document.createElement("i"));
  }

  const topbar = document.createElement("div");
  topbar.id = "topbar";
  const equipBtn = document.createElement("button");
  equipBtn.className = "tbtn nudge";
  equipBtn.id = "equipBtn";
  equipBtn.type = "button";
  equipBtn.innerHTML = `EQUIP<span class="dot"></span><span class="pad">START</span>`;
  topbar.appendChild(equipBtn);

  const overlay = document.createElement("div");
  overlay.id = "equip";
  overlay.innerHTML =
    '<div class="sheet">' +
    '<div class="top"><h2>EQUIP</h2><button class="tbtn" id="equipDone" type="button">DONE</button></div>' +
    '<p class="note" id="equipNote"></p>' +
    '<div class="net" id="net"></div>' +
    '<p class="note" style="text-align:center;margin:14px 0 0">' +
    "Drag an ability onto a face. Drag between faces to swap.<br>" +
    "Opposite faces can never come up in the same roll.</p>" +
    '<div class="tray" id="tray"></div>' +
    "</div>";
  const ghost = document.createElement("div");
  ghost.id = "ghost";

  root.appendChild(armed);
  root.appendChild(topbar);
  root.appendChild(overlay);
  root.appendChild(ghost);

  const locname = document.createElement("div");
  locname.id = "locname";
  locname.innerHTML = '<div class="t"></div><div class="rule"></div>';
  const banner = document.createElement("div");
  banner.id = "banner";
  const footer = document.createElement("div");
  footer.id = "footer";
  footer.innerHTML = '<span class="hint" id="hintEl"></span>';
  const speakBtn = document.createElement("button");
  speakBtn.className = "tbtn";
  speakBtn.id = "speak";
  speakBtn.type = "button";
  speakBtn.innerHTML = `<span class="btn">Y</span>SPEAK`;
  const dialog = document.createElement("div");
  dialog.id = "dialog";
  dialog.innerHTML = `<div class="who">${NPC_NAME}</div><div class="line"></div><div class="cue">${DIALOG_CUE_TOUCH}</div>`;
  const stick = document.createElement("div");
  stick.id = "stick";
  stick.innerHTML =
    '<svg id="dpad" viewBox="0 0 100 100" aria-hidden="true">' +
    '<polygon class="frame" points="30,0 70,0 70,30 100,30 100,70 70,70 70,100 30,100 30,70 0,70 0,30 30,30"/>' +
    "</svg>" +
    '<div id="knob"></div>';
  const pivotBtn = document.createElement("button");
  pivotBtn.id = "pivot";
  pivotBtn.type = "button";
  pivotBtn.innerHTML = `<span class="gl">⟳</span>PIVOT<span class="pad">B</span>`;
  root.appendChild(locname);
  root.appendChild(banner);
  root.appendChild(footer);
  root.appendChild(speakBtn);
  root.appendChild(dialog);
  root.appendChild(stick);
  root.appendChild(pivotBtn);
  host.appendChild(root);

  const netEl = overlay.querySelector("#net");
  const trayEl = overlay.querySelector("#tray");
  const noteEl = overlay.querySelector("#equipNote");
  const doneBtn = overlay.querySelector("#equipDone");
  const sw = armed.querySelector("#sw");
  const nm = armed.querySelector("#nm");
  const sb = armed.querySelector("#sb");
  const underEl = armed.querySelector("#underEl");
  const dbg = armed.querySelector("#dbg");
  const locTitle = locname.querySelector(".t");
  const hintEl = footer.querySelector("#hintEl");
  const dialogLine = dialog.querySelector(".line");
  const dialogCue = dialog.querySelector(".cue");
  if (
    !(netEl instanceof HTMLElement) ||
    !(trayEl instanceof HTMLElement) ||
    !(noteEl instanceof HTMLElement) ||
    !(doneBtn instanceof HTMLButtonElement) ||
    !(sw instanceof HTMLElement) ||
    !(nm instanceof HTMLElement) ||
    !(sb instanceof HTMLElement) ||
    !(underEl instanceof HTMLElement) ||
    !(dbg instanceof HTMLElement) ||
    !(locTitle instanceof HTMLElement) ||
    !(hintEl instanceof HTMLElement) ||
    !(dialogLine instanceof HTMLElement) ||
    !(dialogCue instanceof HTMLElement)
  ) {
    throw new Error("hud mount failed");
  }
  const net = netEl;
  const tray = trayEl;
  const note = noteEl;
  const done = doneBtn;

  for (const cell of NET_CELLS) {
    const d = document.createElement("div");
    d.className = "slot";
    d.dataset.face = String(cell.face);
    d.style.gridColumn = String(cell.col);
    d.style.gridRow = String(cell.row);
    d.innerHTML = `<span class="ori"></span><span class="tag">${FACE_BODY_LABEL[cell.face]}</span>`;
    net.appendChild(d);
  }
  const slotEls = [...net.querySelectorAll(".slot")].filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  let latest: SimSnapshot | undefined;
  let draft = [0, 0, 0, 0, 0, 0];
  let open = false;
  let dialogOpen = false;
  let dialogIdx = 0;
  let dialogLines: readonly string[] = [];
  let lastRegion = -1;
  let lastPlace = "";
  let placeArmed = false;
  let locUntil = 0;
  let bannerUntil = 0;
  let lastBannerTick = -1;
  let padConnected = false;
  let drag: DragState | null = null;
  let selected: number | null = null;
  let pending: { kind: number; face: number | null; x0: number; y0: number } | null = null;
  let equipUp = 0;
  let equipDown = 1;

  const foundIds = (found: number): number[] => {
    const ids: number[] = [];
    for (let id = 1; id <= ABILITY_MAX; id++) if (abilityFound(found, id)) ids.push(id);
    ids.push(ABILITY_NORMAL);
    return ids;
  };

  const paintNet = () => {
    for (const el of slotEls) {
      const f = Number(el.dataset.face);
      const kind = kindOf(draft[f] ?? 0);
      el.style.backgroundImage = `url(${urls[kind]})`;
      el.classList.toggle("empty", (draft[f] ?? 0) === ABILITY_NORMAL);
      el.classList.toggle("up", f === equipUp);
      el.classList.toggle("down", f === equipDown);
      const ori = el.querySelector(".ori");
      if (ori) ori.textContent = f === equipDown ? "DOWN" : f === equipUp ? "UP" : "";
    }
    const n = armedCount(draft);
    const clash = axisClash(draft);
    const foundN = foundIds(latest?.player.found ?? 0).length - 1;
    note.textContent =
      foundN === 0
        ? "Nothing found yet. Glyphs are out there in the Blank."
        : n === 0
          ? "Every face is blank. Drag a found glyph onto one to arm it."
          : `${n} of 6 faces armed.${
              clash
                ? " Two abilities share an axis, so they can never follow each other in one roll."
                : ""
            }`;
  };

  const buildTray = () => {
    tray.replaceChildren();
    const found = latest?.player.found ?? 0;
    for (const id of foundIds(found)) {
      const kind = kindOf(id);
      const c = document.createElement("div");
      c.className = "chip";
      c.dataset.kind = String(id);
      c.innerHTML =
        `<span class="sw" style="background-image:url(${urls[kind]})"></span>` +
        `<span class="nm">${id === ABILITY_NORMAL ? "CLEAR" : ABILITY_LABEL[kind].toUpperCase()}</span>`;
      wireDrag(
        c,
        () => id,
        () => null,
      );
      tray.appendChild(c);
    }
  };

  const paintCue = () => {
    dialogCue.textContent = padConnected ? DIALOG_CUE_PAD : DIALOG_CUE_TOUCH;
  };

  const showBanner = (text: string, ms: number) => {
    banner.textContent = text;
    banner.classList.add("show");
    bannerUntil = Date.now() + ms;
  };

  const emitModal = () => {
    opts.onModal?.(open || dialogOpen);
  };

  const setDialog = (next: boolean) => {
    dialogOpen = next;
    dialog.classList.toggle("open", next);
    speakBtn.classList.toggle("on", false);
    emitModal();
  };

  const openDialog = () => {
    if (open || !latest) return;
    dialogLines = NPC_LINES[latest.world.stage] ?? NPC_LINES[0] ?? [];
    dialogIdx = 0;
    dialogLine.textContent = dialogLines[0] ?? "";
    setDialog(true);
  };

  const advanceDialog = () => {
    if (!dialogOpen) return;
    dialogIdx += 1;
    if (dialogIdx >= dialogLines.length) {
      setDialog(false);
      return;
    }
    dialogLine.textContent = dialogLines[dialogIdx] ?? "";
  };

  const setOpen = (next: boolean) => {
    if (next && dialogOpen) setDialog(false);
    open = next;
    overlay.classList.toggle("open", next);
    emitModal();
    if (next && latest) {
      draft = cloneFaces(latest.player.faces);
      equipUp = UP(latest.player.orientation);
      equipDown = DOWN(latest.player.orientation);
      selected = null;
      buildTray();
      paintNet();
    }
  };

  const commit = () => {
    const ok = opts.onCommit?.(draft.slice()) !== false;
    if (ok) setOpen(false);
  };

  function wireDrag(el: HTMLElement, getKind: () => number, getFace: () => number | null): void {
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const kind = getKind();
      const face = getFace();
      pending =
        kind === ABILITY_NORMAL && face !== null
          ? null
          : { kind, face, x0: e.clientX, y0: e.clientY };
    });
    el.addEventListener("pointermove", (e) => {
      if (drag) {
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot");
        for (const slot of slotEls) {
          slot.classList.toggle("hover", slot === over);
          const overFace = over instanceof HTMLElement ? Number(over.dataset.face) : -1;
          slot.classList.toggle(
            "opp",
            overFace >= 0 && Number(slot.dataset.face) === (overFace ^ 1),
          );
        }
        return;
      }
      if (!pending) return;
      if (pastSlop(pending.x0, pending.y0, e.clientX, e.clientY, DRAG_SLOP)) {
        drag = { kind: pending.kind, fromFace: pending.face };
        ghost.style.backgroundImage = `url(${urls[kindOf(pending.kind)]})`;
        ghost.style.display = "block";
        ghost.style.left = `${e.clientX}px`;
        ghost.style.top = `${e.clientY}px`;
      }
    });
    el.addEventListener("pointerup", (e) => {
      if (drag) {
        pending = null;
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest(".slot");
        if (over instanceof HTMLElement) dropOn(draft, drag, Number(over.dataset.face));
        else dropOffNet(draft, drag);
        drag = null;
        ghost.style.display = "none";
        for (const slot of slotEls) slot.classList.remove("hover", "opp");
        paintNet();
        return;
      }
      pending = null;
      const face = getFace();
      if (face === null) {
        selected = toggleChip(selected, getKind());
        for (const c of tray.children) {
          if (c instanceof HTMLElement)
            c.classList.toggle("sel", Number(c.dataset.kind) === selected);
        }
      } else if (selected !== null) {
        tapPlace(draft, selected, face);
        paintNet();
      }
    });
    el.addEventListener("pointercancel", () => {
      pending = null;
      drag = null;
      ghost.style.display = "none";
      for (const slot of slotEls) slot.classList.remove("hover", "opp");
    });
  }

  for (const el of slotEls) {
    wireDrag(
      el,
      () => draft[Number(el.dataset.face)] ?? 0,
      () => Number(el.dataset.face),
    );
  }

  equipBtn.addEventListener("click", () => setOpen(true));
  done.addEventListener("click", commit);
  speakBtn.addEventListener("click", openDialog);
  dialog.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    advanceDialog();
  });
  window.addEventListener("keydown", (e) => {
    if (dialogOpen && (e.code === "Space" || e.code === "Enter")) {
      e.preventDefault();
      advanceDialog();
      return;
    }
    if (e.code === "KeyE" && !open && !dialogOpen) {
      e.preventDefault();
      setOpen(true);
    } else if (e.code === "Escape" && open) {
      e.preventDefault();
      commit();
    } else if (e.code === "Escape" && dialogOpen) {
      e.preventDefault();
      setDialog(false);
    }
  });

  const paintArmed = (snapshot: SimSnapshot, kind: AbilityKind, downKind: AbilityKind) => {
    sw.style.background = ABILITY_CSS[kind];
    nm.textContent = ABILITY_LABEL[kind];
    nm.style.color = kind === "normal" ? "#22222a" : ABILITY_CSS[kind];
    sb.textContent = ABILITY_LINE[kind];
    underEl.textContent = `UNDER · ${ABILITY_LABEL[downKind].toUpperCase()}`;
    const pipNodes = pips?.children;
    if (pipNodes) {
      for (let i = 0; i < pipNodes.length; i++) {
        const el = pipNodes[i] as HTMLElement;
        el.style.background = i < snapshot.integrity ? CUBE_BODY : "transparent";
      }
    }
    equipBtn.classList.toggle("nudge", armedCount(snapshot.player.faces) === 0);
  };

  return {
    render(snapshot, alpha, backend) {
      latest = snapshot;
      const up = UP(snapshot.player.orientation);
      const down = DOWN(snapshot.player.orientation);
      const upKind = kindOf(snapshot.player.faces[up] ?? 0);
      const downKind = kindOf(snapshot.player.faces[down] ?? 0);
      paintArmed(snapshot, upKind, downKind);
      const now = Date.now();
      if (snapshot.world.sliceOn !== 0) {
        placeArmed = false;
        lastPlace = "";
        if (snapshot.world.region !== lastRegion) {
          lastRegion = snapshot.world.region;
          locTitle.textContent = REGION_NAME[lastRegion] ?? "";
          locname.classList.add("show");
          locUntil = now + 3400;
        }
      } else {
        const place = nearestPlace(snapshot.player.x, snapshot.player.z);
        const name = place?.name ?? "";
        if (!placeArmed) {
          lastPlace = name;
          placeArmed = true;
        } else if (name !== lastPlace) {
          lastPlace = name;
          if (name !== "") {
            locTitle.textContent = name;
            locname.classList.add("show");
            locUntil = now + 3400;
          }
        }
      }
      if (locUntil > 0 && now >= locUntil) {
        locname.classList.remove("show");
        locUntil = 0;
      }
      if (snapshot.world.banner !== 0 && snapshot.tick !== lastBannerTick) {
        lastBannerTick = snapshot.tick;
        showBanner(BANNER_TEXT[snapshot.world.banner] ?? "", 3500);
      }
      if (bannerUntil > 0 && now >= bannerUntil) {
        banner.classList.remove("show");
        bannerUntil = 0;
      }
      hintEl.textContent =
        snapshot.world.aiming !== 0 ? AIM_HINT : (STAGE_HINT[snapshot.world.stage] ?? "");
      const canSpeak =
        snapshot.world.npcRange !== 0 && !open && !dialogOpen && snapshot.world.sliceOn !== 0;
      speakBtn.classList.toggle("on", canSpeak);
      pivotBtn.classList.toggle("armed", snapshot.move.pivotArmed !== 0);
      if (dialogOpen && snapshot.world.npcRange === 0) setDialog(false);
      dbg.textContent = [
        "SHAPELAND  ·  phase 9",
        backend ? `backend       ${backend}` : "",
        `tick           ${snapshot.tick}`,
        `alpha          ${alpha.toFixed(3)}`,
        `cell           ${snapshot.player.x},${snapshot.player.y},${snapshot.player.z}  ori ${snapshot.player.orientation}`,
        `up/down        ${upKind} / ${downKind}`,
        `hash           ${hex32(snapshot.hashes.total)}`,
        snapshot.vfx.burnDur > 0
          ? `burn           ${snapshot.vfx.burnT}/${snapshot.vfx.burnDur}  plume ${snapshot.vfx.fireCount}`
          : "",
      ]
        .filter((line) => line !== "")
        .join("\n");
    },
    setPadConnected(connected) {
      padConnected = connected;
      paintCue();
    },
    announce(text, ms = 2200) {
      showBanner(text, ms);
    },
    trySpeak() {
      if (latest?.world.npcRange !== 0 && !open && !dialogOpen) openDialog();
    },
    openEquip() {
      setOpen(true);
    },
    commitEquip() {
      commit();
    },
    advanceDialog: () => {
      advanceDialog();
    },
    modalOpen() {
      return open || dialogOpen;
    },
    dialogIsOpen() {
      return dialogOpen;
    },
    equipIsOpen() {
      return open;
    },
    dispose() {
      host.replaceChildren();
    },
  };
}
