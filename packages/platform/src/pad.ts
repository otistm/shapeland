import {
  BUTTON_E,
  BUTTON_JUMP,
  BUTTON_N,
  BUTTON_PIVOT,
  BUTTON_S,
  BUTTON_W,
  PAD_DEAD,
  analogToMask,
} from "@shapeland/sim";

/** Standard mapping. A is jump/confirm; Y is speak — they must not share a verb. */
export const PAD_JUMP = [0] as const;
export const PAD_PIVOT = [1] as const;
export const PAD_SPEAK = [3] as const;
export const PAD_EQUIP = [9, 8] as const;
export const PAD_CAM_CCW = [4] as const;
export const PAD_CAM_CW = [5] as const;
export const PAD_HAT_UP = 12;
export const PAD_HAT_DOWN = 13;
export const PAD_HAT_LEFT = 14;
export const PAD_HAT_RIGHT = 15;

export const PAD_POLICY_MSG =
  "Gamepad unavailable here (blocked by permissions policy); touch and keyboard remain.";

export interface PadSample {
  mask: number;
  connected: boolean;
  id: string;
  risingJump: boolean;
  risingPivot: boolean;
  risingSpeak: boolean;
  risingEquip: boolean;
  risingCamCw: boolean;
  risingCamCcw: boolean;
}

export interface PadPoller {
  readonly blocked: boolean;
  poll(): PadSample;
}

export interface PadDeps {
  getGamepads?: () => ArrayLike<Gamepad | null> | null;
  log?: (msg: string) => void;
}

/**
 * Visit every index. `.some` would return early and leave later buttons' prev
 * bits stale, which then misfires as a rising edge on the next poll.
 */
export function risingGroup(
  nowPressed: (index: number) => boolean,
  indices: readonly number[],
  prevBits: number,
): { any: boolean; nextBits: number } {
  let any = false;
  let next = prevBits;
  for (let k = 0; k < indices.length; k++) {
    const i = indices[k];
    if (i === undefined) continue;
    const bit = 1 << i;
    const now = nowPressed(i);
    const was = (prevBits & bit) !== 0;
    if (now && !was) any = true;
    if (now) next |= bit;
    else next &= ~bit;
  }
  return { any, nextBits: next };
}

let sessionBlocked = false;
let sessionLogged = false;

function readNavigatorPads(log: (msg: string) => void): ArrayLike<Gamepad | null> | null {
  if (sessionBlocked) return null;
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return null;
  try {
    return navigator.getGamepads();
  } catch {
    sessionBlocked = true;
    if (!sessionLogged) {
      sessionLogged = true;
      log(PAD_POLICY_MSG);
    }
    return null;
  }
}

/** Existence is not enough — the API must be called once. Throws disable the session. */
export function probeGamepadApi(log: (msg: string) => void = console.info): boolean {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return false;
  readNavigatorPads(log);
  return !sessionBlocked;
}

function btnPressed(g: Gamepad, i: number): boolean {
  return !!g.buttons[i]?.pressed;
}

function firstPad(list: ArrayLike<Gamepad | null> | null): Gamepad | null {
  if (!list) return null;
  for (let i = 0; i < list.length; i++) {
    const g = list[i];
    if (g?.connected) return g;
  }
  return null;
}

function hatMask(g: Gamepad): number {
  let hx = (btnPressed(g, PAD_HAT_RIGHT) ? 1 : 0) - (btnPressed(g, PAD_HAT_LEFT) ? 1 : 0);
  let hy = (btnPressed(g, PAD_HAT_UP) ? 1 : 0) - (btnPressed(g, PAD_HAT_DOWN) ? 1 : 0);
  if (hx === 0 && hy === 0) return 0;
  const ax = hx < 0 ? -hx : hx;
  const ay = hy < 0 ? -hy : hy;
  if (ax >= ay) hy = 0;
  else hx = 0;
  if (hx > 0) return BUTTON_E;
  if (hx < 0) return BUTTON_W;
  if (hy > 0) return BUTTON_N;
  return BUTTON_S;
}

export type PadRoute = "move" | "confirm" | "speak" | "open-equip" | "close-equip";

/** Modal capture: movement mask stays 0. A confirms dialogue; Y never jumps. */
export function routePad(
  sample: PadSample,
  dialogOpen: boolean,
  equipOpen: boolean,
): { route: PadRoute; mask: number } {
  if (dialogOpen) {
    if (sample.risingJump || sample.risingSpeak) return { route: "confirm", mask: 0 };
    return { route: "move", mask: 0 };
  }
  if (equipOpen) {
    if (sample.risingEquip) return { route: "close-equip", mask: 0 };
    return { route: "move", mask: 0 };
  }
  if (sample.risingEquip) return { route: "open-equip", mask: 0 };
  if (sample.risingSpeak) return { route: "speak", mask: 0 };
  return { route: "move", mask: sample.mask };
}

export function createPadPoller(deps: PadDeps = {}): PadPoller {
  let available = true;
  let blocked = false;
  let logged = false;
  let connected = false;
  let id = "";
  let prevBits = 0;
  const sample: PadSample = {
    mask: 0,
    connected: false,
    id: "",
    risingJump: false,
    risingPivot: false,
    risingSpeak: false,
    risingEquip: false,
    risingCamCw: false,
    risingCamCcw: false,
  };
  const log = deps.log ?? console.info;

  const readList = (): ArrayLike<Gamepad | null> | null => {
    if (deps.getGamepads) {
      if (!available) return null;
      try {
        return deps.getGamepads();
      } catch {
        available = false;
        blocked = true;
        if (!logged) {
          logged = true;
          log(PAD_POLICY_MSG);
        }
        return null;
      }
    }
    if (sessionBlocked) {
      blocked = true;
      available = false;
      return null;
    }
    return readNavigatorPads(log);
  };

  const clearSample = (wasConnected: boolean): PadSample => {
    sample.mask = 0;
    sample.connected = false;
    sample.id = "";
    sample.risingJump = false;
    sample.risingPivot = false;
    sample.risingSpeak = false;
    sample.risingEquip = false;
    sample.risingCamCw = false;
    sample.risingCamCcw = false;
    if (wasConnected) {
      connected = false;
      id = "";
      prevBits = 0;
    }
    return sample;
  };

  return {
    get blocked() {
      return blocked || sessionBlocked;
    },
    poll(): PadSample {
      const g = firstPad(readList());
      if (!g) return clearSample(connected);
      if (!connected) prevBits = 0;
      connected = true;
      id = g.id;

      const hat = hatMask(g);
      const dir = hat !== 0 ? hat : analogToMask(g.axes[0] ?? 0, -(g.axes[1] ?? 0), PAD_DEAD);

      const jump = risingGroup((i) => btnPressed(g, i), PAD_JUMP, prevBits);
      const pivot = risingGroup((i) => btnPressed(g, i), PAD_PIVOT, jump.nextBits);
      const speak = risingGroup((i) => btnPressed(g, i), PAD_SPEAK, pivot.nextBits);
      const equip = risingGroup((i) => btnPressed(g, i), PAD_EQUIP, speak.nextBits);
      const camCcw = risingGroup((i) => btnPressed(g, i), PAD_CAM_CCW, equip.nextBits);
      const camCw = risingGroup((i) => btnPressed(g, i), PAD_CAM_CW, camCcw.nextBits);
      prevBits = camCw.nextBits;

      sample.connected = true;
      sample.id = id;
      sample.risingJump = jump.any;
      sample.risingPivot = pivot.any;
      sample.risingSpeak = speak.any;
      sample.risingEquip = equip.any;
      sample.risingCamCcw = camCcw.any;
      sample.risingCamCw = camCw.any;
      // Pulse jump/pivot so a hold through a modal cannot rising-edge the sim on close.
      sample.mask = dir | (jump.any ? BUTTON_JUMP : 0) | (pivot.any ? BUTTON_PIVOT : 0);
      return sample;
    },
  };
}
