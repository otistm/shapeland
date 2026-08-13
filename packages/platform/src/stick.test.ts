import { BUTTON_E, BUTTON_N, STICK_R, TOUCH_DEAD, analogToMask } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { type StickState, lockStick, stickToMask } from "./stick";

describe("qa-dpad stick travel", () => {
  it("slides along the plus arms and never sits on a diagonal", () => {
    const out: StickState = { dx: 0, dy: 0, x: 0, y: 0 };
    lockStick(30, 10, STICK_R, out);
    expect(out.dy).toBe(0);
    expect(out.dx).toBe(30);
    expect(out.x).toBe(30 / STICK_R);
    expect(out.y).toBe(0);

    lockStick(10, 30, STICK_R, out);
    expect(out.dx).toBe(0);
    expect(out.dy).toBe(30);
    expect(out.y).toBe(-30 / STICK_R);

    lockStick(80, 80, STICK_R, out);
    expect(out.dy).toBe(0);
    expect(out.dx).toBe(STICK_R);
    expect(out.x).toBe(1);
    expect(out.y).toBe(0);
    expect(stickToMask(out)).toBe(BUTTON_E);
  });

  it("matches STICK_R 40 and the touch dead zone of 0.36", () => {
    expect(STICK_R).toBe(40);
    const out: StickState = { dx: 0, dy: 0, x: 0, y: 0 };
    lockStick(0, -(TOUCH_DEAD * STICK_R), STICK_R, out);
    expect(stickToMask(out)).toBe(BUTTON_N);
    lockStick(0, -(0.35 * STICK_R), STICK_R, out);
    expect(analogToMask(out.x, out.y, TOUCH_DEAD)).toBe(0);
  });
});
