import { SKY_CREV, SKY_SIDE, SKY_STACK, SKY_TOP } from "@shapeland/sim";
import { CanvasTexture, SRGBColorSpace } from "three/webgpu";
import { makeToon } from "./toon";

const TEXEL = 128;

/** Cool-cast grey matching the prototype bake. */
export function skyGrey(v: number): [number, number, number] {
  const c = Math.round(255 * v);
  const b = Math.round(255 * Math.min(1, v * 1.02));
  return [c, c, b];
}

export function skyGreyHex(v: number): string {
  const [r, g, b] = skyGrey(v);
  const n = (r << 16) | (g << 8) | b;
  return `#${n.toString(16).padStart(6, "0")}`;
}

export function skySideValue(unitsBelowSummit: number): number {
  return SKY_SIDE - SKY_STACK * unitsBelowSummit;
}

export function skyCreviceValue(unitsBelowSummit: number): number {
  return skySideValue(unitsBelowSummit) * SKY_CREV;
}

export function skyCourseDelta(): number {
  return SKY_STACK / SKY_SIDE;
}

function cssGrey(v: number): string {
  const [r, g, b] = skyGrey(v);
  return `rgb(${r},${g},${b})`;
}

export function bakeTerrainTop(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = TEXEL;
  c.height = TEXEL;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = cssGrey(SKY_TOP);
    g.fillRect(0, 0, TEXEL, TEXEL);
    const vig = g.createRadialGradient(
      TEXEL / 2,
      TEXEL / 2,
      TEXEL * 0.3,
      TEXEL / 2,
      TEXEL / 2,
      TEXEL * 0.72,
    );
    vig.addColorStop(0, "rgba(150,163,200,0)");
    vig.addColorStop(1, "rgba(150,163,200,0.16)");
    g.fillStyle = vig;
    g.fillRect(0, 0, TEXEL, TEXEL);
    g.strokeStyle = "rgba(132,148,196,0.70)";
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, TEXEL - 3, TEXEL - 3);
  }
  const tex = new CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function bakeTerrainSide(h: number): CanvasTexture {
  const units = h < 1 ? 1 : h | 0;
  const c = document.createElement("canvas");
  c.width = TEXEL;
  c.height = TEXEL * units;
  const g = c.getContext("2d");
  if (g) {
    for (let i = 0; i < units; i++) {
      const v = skySideValue(i);
      const y = i * TEXEL;
      const grd = g.createLinearGradient(0, y, 0, y + TEXEL);
      grd.addColorStop(0, cssGrey(v));
      grd.addColorStop(1, cssGrey(v * SKY_CREV));
      g.fillStyle = grd;
      g.fillRect(0, y, TEXEL, TEXEL);
      g.fillStyle = "rgba(120,134,178,0.55)";
      g.fillRect(0, y, TEXEL, 3);
    }
    const edge = g.createLinearGradient(0, 0, TEXEL, 0);
    edge.addColorStop(0, "rgba(120,134,178,0.30)");
    edge.addColorStop(0.14, "rgba(120,134,178,0)");
    edge.addColorStop(0.86, "rgba(120,134,178,0)");
    edge.addColorStop(1, "rgba(120,134,178,0.30)");
    g.fillStyle = edge;
    g.fillRect(0, 0, TEXEL, TEXEL * units);
    g.fillStyle = "rgba(104,118,162,0.45)";
    g.fillRect(0, TEXEL * units - 4, TEXEL, 4);
  }
  const tex = new CanvasTexture(c);
  tex.anisotropy = 8;
  tex.colorSpace = SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function makeTerrainMaterials(heights: Iterable<number>): {
  top: ReturnType<typeof makeToon>;
  side: Map<number, ReturnType<typeof makeToon>>;
} {
  const top = makeToon({ color: 0xffffff, map: bakeTerrainTop() });
  const side = new Map<number, ReturnType<typeof makeToon>>();
  for (const h of heights) {
    if (h <= 0 || side.has(h)) continue;
    side.set(h, makeToon({ color: 0xffffff, map: bakeTerrainSide(h) }));
  }
  return { top, side };
}
