import { SKY_CREV, SKY_SIDE, SKY_STACK, SKY_TOP } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { contrastRatio } from "./palette";
import { skyCourseDelta, skyGrey, skyGreyHex, skySideValue } from "./terrain-mat";

describe("qa-toon terrain readability", () => {
  it("bakes sky exposure so stacked units stay countable on white", () => {
    expect(SKY_TOP).toBe(1);
    expect(SKY_SIDE).toBe(0.78);
    expect(skyGrey(SKY_TOP)).toEqual([255, 255, 255]);
    expect(skySideValue(0)).toBe(SKY_SIDE);
    expect(skySideValue(1)).toBeCloseTo(SKY_SIDE - SKY_STACK, 10);
    expect(skyCourseDelta()).toBeCloseTo(0.07, 2);
    expect(SKY_TOP / SKY_SIDE).toBeCloseTo(1.27, 1);

    const top = skyGreyHex(SKY_TOP);
    const side = skyGreyHex(SKY_SIDE);
    const crevice = skyGreyHex(SKY_SIDE * SKY_CREV);
    const lit = contrastRatio(top, side);
    const shaded = contrastRatio(top, crevice);
    expect(lit).toBeGreaterThan(1.6);
    expect(shaded).toBeGreaterThan(lit);
  });
});
