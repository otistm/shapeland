import { type AbilityKind, ABILITY_KINDS, FACE_SIZE, drawAbilityFace } from "@shapeland/content";

export type AbilityCanvases = Record<AbilityKind, HTMLCanvasElement>;

export function bakeAbilityCanvases(): AbilityCanvases {
  const out = {} as AbilityCanvases;
  for (const kind of ABILITY_KINDS) {
    const canvas = document.createElement("canvas");
    canvas.width = FACE_SIZE;
    canvas.height = FACE_SIZE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d canvas unavailable for face bake");
    drawAbilityFace(ctx, kind);
    out[kind] = canvas;
  }
  return out;
}

export function abilityUrls(canvases: AbilityCanvases): Record<AbilityKind, string> {
  const out = {} as Record<AbilityKind, string>;
  for (const kind of ABILITY_KINDS) out[kind] = canvases[kind].toDataURL();
  return out;
}
