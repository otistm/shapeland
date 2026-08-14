import { BUTTON_E, BUTTON_JUMP, BUTTON_N, BUTTON_PIVOT, BUTTON_S, BUTTON_W } from "@shapeland/sim";
import { probeGamepadApi } from "./pad";

export interface Capabilities {
  canvas2d: boolean;
  webgpu: boolean;
  webgl2: boolean;
  gamepad: boolean;
}

export function probeCapabilities(): Capabilities {
  const twoD = document.createElement("canvas");
  const gl = document.createElement("canvas");
  let webgl2 = false;
  try {
    webgl2 = gl.getContext("webgl2") !== null;
  } catch {
    webgl2 = false;
  }
  return {
    canvas2d: twoD.getContext("2d") !== null,
    webgpu: "gpu" in navigator,
    webgl2,
    gamepad: probeGamepadApi(),
  };
}

export function nowSeconds(): number {
  return performance.now() / 1000;
}

const KEY_MASK: Record<string, number> = {
  KeyW: BUTTON_N,
  ArrowUp: BUTTON_N,
  KeyS: BUTTON_S,
  ArrowDown: BUTTON_S,
  KeyD: BUTTON_E,
  ArrowRight: BUTTON_E,
  KeyA: BUTTON_W,
  ArrowLeft: BUTTON_W,
  Space: BUTTON_JUMP,
  KeyQ: BUTTON_PIVOT,
  ShiftLeft: BUTTON_PIVOT,
};

const CAM_CW = new Set(["KeyC", "Period", "BracketRight"]);
const CAM_CCW = new Set(["KeyZ", "Comma", "BracketLeft"]);

export function bindKeyboard(
  target: EventTarget,
  onMask: (mask: number) => void,
  onCam?: (delta: 1 | -1) => void,
): () => void {
  const down = new Set<string>();
  const emit = () => {
    let mask = 0;
    for (const key of down) mask |= KEY_MASK[key] ?? 0;
    onMask(mask);
  };
  const onDown = (ev: Event) => {
    const kev = ev as KeyboardEvent;
    if (onCam && !kev.repeat) {
      if (CAM_CW.has(kev.code)) {
        kev.preventDefault();
        onCam(1);
        return;
      }
      if (CAM_CCW.has(kev.code)) {
        kev.preventDefault();
        onCam(-1);
        return;
      }
    }
    if (KEY_MASK[kev.code] === undefined) return;
    kev.preventDefault();
    down.add(kev.code);
    emit();
  };
  const onUp = (ev: Event) => {
    const kev = ev as KeyboardEvent;
    down.delete(kev.code);
    emit();
  };
  /** Lost keyup (alt-tab, iframe blur) would otherwise chain the last cardinal forever. */
  const clearHeld = () => {
    if (down.size === 0) return;
    down.clear();
    emit();
  };
  const onVis = () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") clearHeld();
  };
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  target.addEventListener("blur", clearHeld);
  const win = typeof window !== "undefined" ? window : undefined;
  const doc = typeof document !== "undefined" ? document : undefined;
  if (win && win !== target) win.addEventListener("blur", clearHeld);
  doc?.addEventListener("visibilitychange", onVis);
  return () => {
    target.removeEventListener("keydown", onDown);
    target.removeEventListener("keyup", onUp);
    target.removeEventListener("blur", clearHeld);
    if (win && win !== target) win.removeEventListener("blur", clearHeld);
    doc?.removeEventListener("visibilitychange", onVis);
  };
}

export { loadLoadoutJson, saveLoadoutJson, readStore, writeStore } from "./storage";
export {
  PAD_POLICY_MSG,
  analogAxis,
  createPadPoller,
  probeGamepadApi,
  risingGroup,
  routePad,
  type PadPoller,
  type PadSample,
  type PadRoute,
} from "./pad";
export {
  bindCanvasJump,
  bindHoldButton,
  bindTouchStick,
  lockStick,
  stickToMask,
  type StickState,
  type TouchStickHandle,
} from "./stick";
