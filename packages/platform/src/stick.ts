import { STICK_R, TOUCH_DEAD, analogToMask } from "@shapeland/sim";

export interface StickState {
  dx: number;
  dy: number;
  x: number;
  y: number;
}

/** Lock to one axis, clamp to `radius`. Screen +y is down; analog +y is north. */
export function lockStick(dx: number, dy: number, radius: number, out: StickState): void {
  const ax = dx < 0 ? -dx : dx;
  const ay = dy < 0 ? -dy : dy;
  let x = ax >= ay ? dx : 0;
  let y = ax >= ay ? 0 : dy;
  if (x > radius) x = radius;
  else if (x < -radius) x = -radius;
  if (y > radius) y = radius;
  else if (y < -radius) y = -radius;
  out.dx = x;
  out.dy = y;
  out.x = radius === 0 ? 0 : x / radius;
  out.y = radius === 0 ? 0 : 0 - y / radius;
}

export function stickToMask(state: StickState, dead: number = TOUCH_DEAD): number {
  return analogToMask(state.x, state.y, dead);
}

export interface TouchStickHandle {
  clear(): void;
  dispose(): void;
}

export function bindTouchStick(
  stick: HTMLElement,
  knob: HTMLElement,
  onChange: (mask: number) => void,
  blocked: () => boolean,
): TouchStickHandle {
  const pos: StickState = { dx: 0, dy: 0, x: 0, y: 0 };
  let pointerId: number | null = null;

  const apply = (clientX: number, clientY: number) => {
    const r = stick.getBoundingClientRect();
    lockStick(clientX - (r.left + r.width / 2), clientY - (r.top + r.height / 2), STICK_R, pos);
    knob.style.transform = `translate(${pos.dx}px, ${pos.dy}px)`;
    onChange(stickToMask(pos));
  };

  const clear = () => {
    pointerId = null;
    pos.dx = pos.dy = pos.x = pos.y = 0;
    knob.style.transform = "";
    knob.style.borderColor = "";
    onChange(0);
  };

  const onDown = (ev: PointerEvent) => {
    if (blocked()) return;
    pointerId = ev.pointerId;
    stick.setPointerCapture(ev.pointerId);
    knob.style.borderColor = "#9a978f";
    apply(ev.clientX, ev.clientY);
  };
  const onMove = (ev: PointerEvent) => {
    if (ev.pointerId !== pointerId) return;
    apply(ev.clientX, ev.clientY);
  };
  const onUp = (ev: PointerEvent) => {
    if (ev.pointerId === pointerId) clear();
  };

  stick.addEventListener("pointerdown", onDown);
  stick.addEventListener("pointermove", onMove);
  stick.addEventListener("pointerup", onUp);
  stick.addEventListener("pointercancel", clear);

  return {
    clear,
    dispose() {
      stick.removeEventListener("pointerdown", onDown);
      stick.removeEventListener("pointermove", onMove);
      stick.removeEventListener("pointerup", onUp);
      stick.removeEventListener("pointercancel", clear);
      clear();
    },
  };
}

export function bindHoldButton(
  el: HTMLElement,
  onChange: (down: boolean) => void,
  blocked: () => boolean,
): () => void {
  const down = (ev: PointerEvent) => {
    if (blocked()) return;
    ev.preventDefault();
    onChange(true);
  };
  const up = () => onChange(false);
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  return () => {
    el.removeEventListener("pointerdown", down);
    el.removeEventListener("pointerup", up);
    el.removeEventListener("pointercancel", up);
  };
}

export function bindCanvasJump(
  canvas: HTMLElement,
  onChange: (down: boolean) => void,
  blocked: () => boolean,
): () => void {
  const down = (ev: PointerEvent) => {
    if (blocked()) return;
    ev.preventDefault();
    onChange(true);
  };
  const up = () => onChange(false);
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
  };
}
