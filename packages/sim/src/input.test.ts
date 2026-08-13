import { describe, expect, it } from "vitest";
import {
  BUTTON_E,
  BUTTON_JUMP,
  BUTTON_N,
  BUTTON_PIVOT,
  BUTTON_S,
  BUTTON_W,
  DIR_E,
  DIR_N,
  PAD_DEAD,
  TOUCH_DEAD,
} from "./constants";
import { analogToMask, dirFromMask, mergeInputMasks } from "./input";

describe("qa-dpad axis lock", () => {
  it("lets the larger component win and zeros the other", () => {
    expect(analogToMask(0.9, 0.4, TOUCH_DEAD)).toBe(BUTTON_E);
    expect(analogToMask(-0.9, 0.4, TOUCH_DEAD)).toBe(BUTTON_W);
    expect(analogToMask(0.4, 0.9, TOUCH_DEAD)).toBe(BUTTON_N);
    expect(analogToMask(0.4, -0.9, TOUCH_DEAD)).toBe(BUTTON_S);
    expect(dirFromMask(analogToMask(0.9, 0.4, TOUCH_DEAD))).toBe(DIR_E);
    expect(dirFromMask(analogToMask(0.4, 0.9, TOUCH_DEAD))).toBe(DIR_N);
  });

  it("prefers X when the axes are equal, matching dirFromMask", () => {
    expect(analogToMask(0.8, 0.8, TOUCH_DEAD)).toBe(BUTTON_E);
    expect(analogToMask(-0.8, 0.8, TOUCH_DEAD)).toBe(BUTTON_W);
    expect(dirFromMask(BUTTON_N | BUTTON_E)).toBe(DIR_E);
    expect(dirFromMask(analogToMask(0.8, 0.8, TOUCH_DEAD))).toBe(DIR_E);
  });

  it("uses the input's own dead zone (touch 0.36, pad 0.38)", () => {
    expect(analogToMask(0.35, 0, TOUCH_DEAD)).toBe(0);
    expect(analogToMask(0.36, 0, TOUCH_DEAD)).toBe(BUTTON_E);
    expect(analogToMask(0, 0.37, PAD_DEAD)).toBe(0);
    expect(analogToMask(0, 0.38, PAD_DEAD)).toBe(BUTTON_N);
    expect(analogToMask(0.2, 0.2, TOUCH_DEAD)).toBe(0);
  });
});

describe("qa-dpad merge", () => {
  it("lets touch dir beat pad dir beat keyboard dir, and ORs actions", () => {
    expect(mergeInputMasks(BUTTON_N, BUTTON_E, BUTTON_W)).toBe(BUTTON_E);
    expect(mergeInputMasks(BUTTON_N, 0, BUTTON_W)).toBe(BUTTON_W);
    expect(mergeInputMasks(BUTTON_N, 0, 0)).toBe(BUTTON_N);
    expect(mergeInputMasks(BUTTON_JUMP, BUTTON_PIVOT, BUTTON_E)).toBe(
      BUTTON_E | BUTTON_JUMP | BUTTON_PIVOT,
    );
    expect(dirFromMask(mergeInputMasks(BUTTON_N | BUTTON_E, 0, 0))).toBe(DIR_E);
  });
});
