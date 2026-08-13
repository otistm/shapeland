import { type AbilityKind, FACE_SIZE, drawAbilityFace } from "@shapeland/content";

export type AbilityCanvases = Record<AbilityKind, HTMLCanvasElement>;

export function bakeAbilityCanvases(): AbilityCanvases {
  const kinds: AbilityKind[] = ["normal", "fire", "lightning", "physical"];
  const out = {} as AbilityCanvases;
  for (const kind of kinds) {
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
  return {
    normal: canvases.normal.toDataURL(),
    fire: canvases.fire.toDataURL(),
    lightning: canvases.lightning.toDataURL(),
    physical: canvases.physical.toDataURL(),
  };
}
