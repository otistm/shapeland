import { ABILITY_FIRE, ABILITY_NORMAL, OPPOSITE } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import {
  DRAG_SLOP,
  FACE_BODY_LABEL,
  NET_CELLS,
  cloneFaces,
  dropOffNet,
  dropOn,
  oppositeOf,
  pastSlop,
  tapPlace,
  toggleChip,
} from "./equip-net";

describe("qa-equip net topology", () => {
  it("is a 6-cell cross of unique sim faces whose opposites are f ^ 1", () => {
    expect(NET_CELLS).toHaveLength(6);
    const faces = NET_CELLS.map((c) => c.face);
    expect(new Set(faces).size).toBe(6);
    expect(faces.sort()).toEqual([0, 1, 2, 3, 4, 5]);
    for (const face of faces) {
      expect(oppositeOf(face)).toBe(OPPOSITE(face));
      expect(faces).toContain(oppositeOf(face));
    }
    expect(FACE_BODY_LABEL).toHaveLength(6);
    const top = NET_CELLS.find((c) => c.face === 0);
    const bottom = NET_CELLS.find((c) => c.face === 1);
    const front = NET_CELLS.find((c) => c.face === 5);
    expect(top?.col).toBe(2);
    expect(top?.row).toBe(1);
    expect(front?.col).toBe(2);
    expect(front?.row).toBe(2);
    expect(bottom?.col).toBe(2);
    expect(bottom?.row).toBe(3);
  });
});

describe("qa-equip drag semantics", () => {
  it("places from the tray, swaps two faces, and clears a drag off the net", () => {
    const draft = cloneFaces([0, 0, 0, 0, 0, 0]);
    dropOn(draft, { kind: ABILITY_FIRE, fromFace: null }, 0);
    expect(draft[0]).toBe(ABILITY_FIRE);
    dropOn(draft, { kind: ABILITY_FIRE, fromFace: 0 }, 2);
    expect(draft[0]).toBe(ABILITY_NORMAL);
    expect(draft[2]).toBe(ABILITY_FIRE);
    dropOffNet(draft, { kind: ABILITY_FIRE, fromFace: 2 });
    expect(draft[2]).toBe(ABILITY_NORMAL);
  });

  it("separates tap from drag at 6px and supports tap-select then tap-place", () => {
    expect(pastSlop(0, 0, 3, 3)).toBe(false);
    expect(pastSlop(0, 0, DRAG_SLOP + 1, 0)).toBe(true);
    const draft = cloneFaces([0, 0, 0, 0, 0, 0]);
    const selected = toggleChip(null, ABILITY_FIRE);
    expect(selected).toBe(ABILITY_FIRE);
    expect(toggleChip(selected, ABILITY_FIRE)).toBeNull();
    tapPlace(draft, ABILITY_FIRE, 4);
    expect(draft[4]).toBe(ABILITY_FIRE);
  });
});

describe("qa-equip draft/commit", () => {
  it("copies committed faces into a draft that does not alias the source", () => {
    const committed = [1, 0, 0, 0, 0, 0];
    const draft = cloneFaces(committed);
    draft[0] = 0;
    expect(committed[0]).toBe(1);
  });
});
