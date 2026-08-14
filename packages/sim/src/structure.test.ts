import { STRUCTURE_MARK, STRUCTURE_PEAK_MAX } from "./constants";
import { describe, expect, it } from "vitest";
import { canRollTo } from "./movement";
import { stampStructure } from "./structure";
import { Terrain } from "./terrain";

describe("structure kit", () => {
  it("clamps piers to the regional monolith and never writes walkable height 21", () => {
    const t = new Terrain();
    stampStructure(t, { kind: "pylon_keep", cx: -8, cz: 0 });
    expect(t.isWall(-10, 0)).toBe(true);
    expect(t.wallHeight(-10, 0)).toBe(STRUCTURE_PEAK_MAX);
    expect(t.height(-10, 0)).toBe(0);
    expect(t.isWall(-8, 0)).toBe(false);
    expect(t.height(-8, 0)).toBe(1);
  });

  it("lets the cube enter a keep and refuses the mass", () => {
    const t = new Terrain();
    stampStructure(t, { kind: "pylon_keep", cx: -8, cz: 0 });
    expect(t.isWall(-6, 0)).toBe(false);
    expect(canRollTo(t, -5, 0, -6, 0)).toBe(true);
    expect(canRollTo(t, -6, 0, -7, 0)).toBe(true);
    expect(t.isWall(-6, 2)).toBe(true);
    expect(canRollTo(t, -5, 0, -6, 2)).toBe(false);
  });

  it("keeps a Salk court open to the south and a Kahn ring closed to the north", () => {
    const salk = new Terrain();
    stampStructure(salk, { kind: "salk_court", cx: 0, cz: 0 });
    expect(salk.isWall(0, 6)).toBe(false);
    expect(salk.isWall(-8, 0)).toBe(true);
    expect(salk.wallHeight(-8, 0)).toBe(STRUCTURE_PEAK_MAX);

    const zig = new Terrain();
    stampStructure(zig, { kind: "assembly", cx: 0, cz: 0 });
    expect(zig.isWall(0, 9)).toBe(false);
    expect(zig.isWall(0, -9)).toBe(true);
    expect(zig.isWall(0, 0)).toBe(false);
  });

  it("leaves a hypostyle nave and gives Habitat both a terrace and a door", () => {
    const hall = new Terrain();
    stampStructure(hall, { kind: "hypostyle", cx: 0, cz: 0 });
    expect(hall.isWall(0, 0)).toBe(false);
    expect(hall.isWall(-2, 0)).toBe(true);
    expect(hall.wallHeight(-2, 0)).toBe(STRUCTURE_MARK);

    const hab = new Terrain();
    stampStructure(hab, { kind: "habitat", cx: 0, cz: 0 });
    expect(hab.height(-3, -3)).toBe(3);
    expect(hab.isWall(0, 0)).toBe(false);
    expect(hab.isWall(7, 0)).toBe(true);
    expect(canRollTo(hab, 6, 0, 7, 0)).toBe(false);
  });
});
