import { CUBE_BODY, FIRE, GLYPH_HALO, ICE, LIGHTNING, PHYSICAL } from "@shapeland/sim";

export const ABILITY_KINDS = ["fire", "lightning", "physical", "ice", "normal"] as const;
export type AbilityKind = (typeof ABILITY_KINDS)[number];

export const FACE_SIZE = 256;

/** Minimal 2D context so content stays DOM-free. Render and UI execute this. */
export interface FaceBrush {
  fillStyle: string | object;
  strokeStyle: string | object;
  lineWidth: number;
  lineJoin: string;
  lineCap: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, a0: number, a1: number): void;
  closePath(): void;
  fill(): void;
  stroke(): void;
}

export function drawAbilityFace(g: FaceBrush, kind: AbilityKind): void {
  const S = FACE_SIZE;
  g.fillStyle = CUBE_BODY;
  g.fillRect(0, 0, S, S);
  g.lineJoin = "round";
  g.lineCap = "round";

  const halo = (path: () => void, fill: string) => {
    path();
    g.strokeStyle = GLYPH_HALO;
    g.lineWidth = 13;
    g.stroke();
    path();
    g.fillStyle = fill;
    g.fill();
  };

  if (kind === "fire") {
    halo(() => {
      g.beginPath();
      g.moveTo(128, 56);
      g.bezierCurveTo(184, 106, 190, 144, 170, 172);
      g.bezierCurveTo(159, 190, 142, 200, 128, 200);
      g.bezierCurveTo(114, 200, 97, 190, 86, 172);
      g.bezierCurveTo(66, 144, 72, 106, 128, 56);
      g.closePath();
    }, FIRE);
    g.fillStyle = "#ffbe4d";
    g.beginPath();
    g.moveTo(128, 118);
    g.bezierCurveTo(154, 142, 154, 160, 143, 174);
    g.bezierCurveTo(137, 182, 132, 186, 128, 186);
    g.bezierCurveTo(124, 186, 119, 182, 113, 174);
    g.bezierCurveTo(102, 160, 102, 142, 128, 118);
    g.closePath();
    g.fill();
    return;
  }

  if (kind === "lightning") {
    halo(() => {
      g.beginPath();
      g.moveTo(150, 50);
      g.lineTo(92, 142);
      g.lineTo(124, 142);
      g.lineTo(106, 208);
      g.lineTo(168, 112);
      g.lineTo(134, 112);
      g.closePath();
    }, LIGHTNING);
    g.fillStyle = "#ffd23f";
    g.beginPath();
    g.moveTo(146, 74);
    g.lineTo(110, 134);
    g.lineTo(124, 134);
    g.lineTo(120, 168);
    g.lineTo(140, 122);
    g.lineTo(126, 122);
    g.closePath();
    g.fill();
    return;
  }

  if (kind === "physical") {
    halo(() => {
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? 84 : 40;
        const x = 128 + Math.cos(a) * r;
        const y = 128 + Math.sin(a) * r;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
    }, PHYSICAL);
    g.fillStyle = "#eef4fc";
    g.beginPath();
    g.arc(128, 128, 17, 0, Math.PI * 2);
    g.fill();
    return;
  }

  if (kind === "ice") {
    halo(() => {
      g.beginPath();
      g.moveTo(128, 48);
      g.lineTo(208, 128);
      g.lineTo(128, 208);
      g.lineTo(48, 128);
      g.closePath();
    }, ICE);
    g.fillStyle = "#7ee7f0";
    g.beginPath();
    g.moveTo(128, 88);
    g.lineTo(168, 128);
    g.lineTo(128, 168);
    g.lineTo(88, 128);
    g.closePath();
    g.fill();
    return;
  }

  g.strokeStyle = "rgba(238,244,252,0.9)";
  g.lineWidth = 9;
  g.beginPath();
  g.arc(128, 128, 50, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = "rgba(238,244,252,0.9)";
  g.beginPath();
  g.arc(128, 128, 9, 0, Math.PI * 2);
  g.fill();
}
