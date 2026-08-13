import { CUBE_BODY, FIRE, GLYPH_HALO, ICE } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { ABILITY_KINDS, type FaceBrush, drawAbilityFace } from "./faces";

class Probe implements FaceBrush {
  fills: string[] = [];
  strokes: string[] = [];
  fillStyle = "";
  strokeStyle = "";
  lineWidth = 0;
  lineJoin = "";
  lineCap = "";
  fillRect(): void {
    this.fills.push(this.fillStyle);
  }
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  bezierCurveTo(): void {}
  arc(): void {}
  closePath(): void {}
  fill(): void {
    this.fills.push(this.fillStyle);
  }
  stroke(): void {
    this.strokes.push(this.strokeStyle);
  }
}

describe("face canvases", () => {
  it("paint the cube body first and halo ability glyphs", () => {
    for (const kind of ABILITY_KINDS) {
      const g = new Probe();
      drawAbilityFace(g, kind);
      expect(g.fills[0]).toBe(CUBE_BODY);
      if (kind === "normal") {
        expect(g.strokes.some((s) => s.startsWith("rgba(238,244,252"))).toBe(true);
      } else {
        expect(g.strokes).toContain(GLYPH_HALO);
      }
    }
    const fire = new Probe();
    drawAbilityFace(fire, "fire");
    expect(fire.fills).toContain(FIRE);
    const ice = new Probe();
    drawAbilityFace(ice, "ice");
    expect(ice.fills).toContain(ICE);
  });
});
