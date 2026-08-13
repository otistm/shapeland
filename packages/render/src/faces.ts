import { ABILITY_KINDS, type AbilityKind, FACE_SIZE, drawAbilityFace } from "@shapeland/content";
import { CanvasTexture } from "three/webgpu";

export function bakeFaceCanvases(): Record<AbilityKind, HTMLCanvasElement> {
  const out = {} as Record<AbilityKind, HTMLCanvasElement>;
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

export function bakeFaceTextures(
  canvases: Record<AbilityKind, HTMLCanvasElement> = bakeFaceCanvases(),
): Record<AbilityKind, CanvasTexture> {
  const out = {} as Record<AbilityKind, CanvasTexture>;
  for (const kind of ABILITY_KINDS) {
    const tex = new CanvasTexture(canvases[kind]);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    out[kind] = tex;
  }
  return out;
}
