import { BUTTON_E, BUTTON_JUMP, BUTTON_N, BUTTON_PIVOT, BUTTON_S, BUTTON_W } from "@shapeland/sim";

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
    gamepad: "getGamepads" in navigator,
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

export function bindKeyboard(target: EventTarget, onMask: (mask: number) => void): () => void {
  const down = new Set<string>();
  const emit = () => {
    let mask = 0;
    for (const key of down) mask |= KEY_MASK[key] ?? 0;
    onMask(mask);
  };
  const onDown = (ev: Event) => {
    const kev = ev as KeyboardEvent;
    if (KEY_MASK[kev.code] === undefined) return;
    down.add(kev.code);
    emit();
  };
  const onUp = (ev: Event) => {
    const kev = ev as KeyboardEvent;
    down.delete(kev.code);
    emit();
  };
  target.addEventListener("keydown", onDown);
  target.addEventListener("keyup", onUp);
  return () => {
    target.removeEventListener("keydown", onDown);
    target.removeEventListener("keyup", onUp);
  };
}
