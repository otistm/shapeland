import { BUTTON_E, BUTTON_N } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { bindKeyboard } from "./index";

function key(type: "keydown" | "keyup", code: string): Event {
  const ev = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "code", { value: code });
  return ev;
}

describe("qa-keyboard held mask", () => {
  it("ORs held cardinals and clears on keyup", () => {
    let mask = 0;
    const target = new EventTarget();
    const unbind = bindKeyboard(target, (next) => {
      mask = next;
    });
    target.dispatchEvent(key("keydown", "KeyD"));
    expect(mask).toBe(BUTTON_E);
    target.dispatchEvent(key("keydown", "KeyW"));
    expect(mask).toBe(BUTTON_E | BUTTON_N);
    target.dispatchEvent(key("keyup", "KeyD"));
    expect(mask).toBe(BUTTON_N);
    target.dispatchEvent(key("keyup", "KeyW"));
    expect(mask).toBe(0);
    unbind();
  });

  it("clears held keys on blur so a lost keyup cannot chain forever", () => {
    let mask = 0;
    const target = new EventTarget();
    const unbind = bindKeyboard(target, (next) => {
      mask = next;
    });
    target.dispatchEvent(key("keydown", "KeyD"));
    expect(mask).toBe(BUTTON_E);
    target.dispatchEvent(new Event("blur"));
    expect(mask).toBe(0);
    unbind();
  });
});
