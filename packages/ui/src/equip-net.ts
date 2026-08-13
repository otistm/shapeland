import { ABILITY_NORMAL, FACE_COUNT, OPPOSITE } from "@shapeland/sim";

/** Body-face labels at identity (sim +Z is TOP). */
export const FACE_BODY_LABEL = ["TOP", "BOTTOM", "RIGHT", "LEFT", "BACK", "FRONT"] as const;

/**
 * Unfolded cross: TOP over FRONT, LEFT / FRONT / RIGHT / BACK across the belt,
 * BOTTOM under FRONT. Faces are sim indices so opposite is `f ^ 1`.
 */
export const NET_CELLS: readonly { face: number; col: number; row: number }[] = [
  { face: 0, col: 2, row: 1 },
  { face: 3, col: 1, row: 2 },
  { face: 5, col: 2, row: 2 },
  { face: 2, col: 3, row: 2 },
  { face: 4, col: 4, row: 2 },
  { face: 1, col: 2, row: 3 },
];

export const DRAG_SLOP = 6;

export interface DragState {
  kind: number;
  fromFace: number | null;
}

export function cloneFaces(faces: ArrayLike<number>): number[] {
  const out = [0, 0, 0, 0, 0, 0];
  for (let i = 0; i < FACE_COUNT; i++) out[i] = faces[i] ?? ABILITY_NORMAL;
  return out;
}

export function dropOn(draft: number[], drag: DragState, toFace: number): void {
  if (toFace < 0 || toFace >= FACE_COUNT) return;
  if (drag.fromFace !== null && drag.fromFace !== toFace) {
    const tmp = draft[toFace] ?? ABILITY_NORMAL;
    draft[toFace] = draft[drag.fromFace] ?? ABILITY_NORMAL;
    draft[drag.fromFace] = tmp;
    return;
  }
  if (drag.fromFace === null) draft[toFace] = drag.kind;
}

export function dropOffNet(draft: number[], drag: DragState): void {
  if (drag.fromFace !== null) draft[drag.fromFace] = ABILITY_NORMAL;
}

export function tapPlace(draft: number[], selected: number | null, face: number): number | null {
  if (selected === null) return null;
  if (face < 0 || face >= FACE_COUNT) return selected;
  draft[face] = selected;
  return selected;
}

export function toggleChip(selected: number | null, kind: number): number | null {
  return selected === kind ? null : kind;
}

export function pastSlop(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  slop = DRAG_SLOP,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  return dx * dx + dy * dy > slop * slop;
}

export function oppositeOf(face: number): number {
  return OPPOSITE(face);
}
