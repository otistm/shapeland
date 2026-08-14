import { describe, expect, it } from "vitest";
import { STRUCTURE_MARK, STRUCTURE_PEAK_MAX } from "./constants";
import { canRollTo } from "./movement";
import {
  INTERIOR_MIN,
  type StructureKind,
  stampStructure,
  structureArchetype,
  structureExtent,
} from "./structure";
import { Terrain } from "./terrain";

const KINDS: readonly StructureKind[] = [
  "pylon_keep",
  "salk_court",
  "assembly",
  "hypostyle",
  "habitat",
];

function flood(
  t: Terrain,
  sx: number,
  sz: number,
  box: { x0: number; z0: number; x1: number; z1: number },
): Set<string> {
  const seen = new Set<string>([`${sx},${sz}`]);
  const qx = [sx];
  const qz = [sz];
  let head = 0;
  while (head < qx.length) {
    const x = qx[head] ?? 0;
    const z = qz[head] ?? 0;
    head += 1;
    const nbs: Array<readonly [number, number]> = [
      [x + 1, z],
      [x - 1, z],
      [x, z + 1],
      [x, z - 1],
    ];
    for (const [nx, nz] of nbs) {
      const k = `${nx},${nz}`;
      if (seen.has(k)) continue;
      if (nx < box.x0 || nx > box.x1 || nz < box.z0 || nz > box.z1) continue;
      if (!canRollTo(t, x, z, nx, nz)) continue;
      seen.add(k);
      qx.push(nx);
      qz.push(nz);
    }
  }
  return seen;
}

function walkableInside(
  t: Terrain,
  box: { x0: number; z0: number; x1: number; z1: number },
): number {
  let n = 0;
  for (let z = box.z0 + 1; z < box.z1; z++) {
    for (let x = box.x0 + 1; x < box.x1; x++) {
      if (!t.isWall(x, z)) n += 1;
    }
  }
  return n;
}

describe("structure kit", () => {
  it("clamps piers to the regional monolith and never writes walkable height 21", () => {
    const t = new Terrain();
    stampStructure(t, { kind: "pylon_keep", cx: -8, cz: 0 });
    expect(t.isWall(-18, -16)).toBe(true);
    expect(t.wallHeight(-18, -16)).toBe(STRUCTURE_PEAK_MAX);
    expect(t.height(-18, -8)).toBe(0);
    expect(t.isWall(-8, 0)).toBe(false);
  });

  it("lets the cube enter a keep through the cave and refuses the mass", () => {
    const t = new Terrain();
    stampStructure(t, { kind: "pylon_keep", cx: -8, cz: 0 });
    expect(t.isWall(2, 0)).toBe(false);
    expect(t.isWall(1, 0)).toBe(false);
    expect(canRollTo(t, 3, 0, 2, 0)).toBe(true);
    expect(canRollTo(t, 2, 0, 1, 0)).toBe(true);
    expect(t.isWall(2, 3)).toBe(true);
    expect(canRollTo(t, 3, 0, 2, 3)).toBe(false);
  });

  it("expresses a 2-cell shell, taller corner piers, and an offset core", () => {
    const t = new Terrain();
    stampStructure(t, { kind: "pylon_keep", cx: -8, cz: 0 });
    expect(t.wallHeight(-18, 0)).toBe(STRUCTURE_MARK);
    expect(t.isWall(-17, 0)).toBe(true);
    expect(t.wallHeight(-18, -16)).toBe(STRUCTURE_PEAK_MAX);
    expect(t.wallHeight(-19, -3)).toBe(STRUCTURE_PEAK_MAX);
    expect(t.isWall(-19, 3)).toBe(false);
  });

  it("keeps a Salk court cave-gated south with opposing cores", () => {
    const salk = new Terrain();
    stampStructure(salk, { kind: "salk_court", cx: 0, cz: 0 });
    expect(salk.isWall(0, 14)).toBe(false);
    expect(salk.isWall(0, 13)).toBe(false);
    expect(salk.isWall(0, -14)).toBe(true);
    expect(salk.wallHeight(-17, -14)).toBe(STRUCTURE_PEAK_MAX);
    expect(salk.wallHeight(17, 14)).toBe(STRUCTURE_PEAK_MAX);
  });

  it("keeps a Kahn ring closed to the north, cave-gated south, and the socket cell clear", () => {
    const zig = new Terrain();
    stampStructure(zig, { kind: "assembly", cx: 0, cz: 0 });
    expect(zig.isWall(0, 16)).toBe(false);
    expect(zig.isWall(0, 15)).toBe(false);
    expect(zig.isWall(0, -16)).toBe(true);
    expect(zig.isWall(0, -15)).toBe(true);
    expect(zig.isWall(0, 0)).toBe(false);
    expect(zig.isWall(0, 1)).toBe(false);
    expect(zig.wallHeight(13, -13)).toBe(STRUCTURE_PEAK_MAX);
  });

  it("leaves a hypostyle nave and a taller east core", () => {
    const hall = new Terrain();
    stampStructure(hall, { kind: "hypostyle", cx: 0, cz: 0 });
    expect(hall.isWall(0, 0)).toBe(false);
    expect(hall.isWall(-3, 0)).toBe(true);
    expect(hall.wallHeight(-3, 0)).toBe(STRUCTURE_MARK);
    expect(hall.wallHeight(17, 0)).toBe(STRUCTURE_PEAK_MAX);
    expect(hall.isWall(0, 16)).toBe(false);
  });

  it("gives Habitat a terrace, a south door, rooms, and a taller core", () => {
    const hab = new Terrain();
    stampStructure(hab, { kind: "habitat", cx: 0, cz: 0 });
    expect(hab.height(-3, 9)).toBe(3);
    expect(hab.isWall(0, 0)).toBe(false);
    expect(hab.isWall(0, 7)).toBe(false);
    expect(canRollTo(hab, 0, 9, 0, 8)).toBe(true);
    expect(hab.wallHeight(11, -2)).toBe(STRUCTURE_PEAK_MAX);
    expect(canRollTo(hab, 10, -2, 11, -2)).toBe(false);
  });

  it("names each kind as an archetype so massing cannot drift from parlante", () => {
    expect(structureArchetype("salk_court")).toBe("institutional");
    expect(structureArchetype("habitat")).toBe("vertical");
    expect(structureArchetype("assembly")).toBe("fortress");
    expect(structureArchetype("pylon_keep")).toBe("fortress");
    expect(structureArchetype("hypostyle")).toBe("institutional");
  });

  it("gives every kind a large multi-room interior reachable from the door", () => {
    const doors: Record<StructureKind, readonly [number, number]> = {
      pylon_keep: [1, 0],
      salk_court: [0, 13],
      assembly: [0, 15],
      hypostyle: [0, 15],
      habitat: [0, 7],
    };
    const rooms: Record<StructureKind, ReadonlyArray<readonly [number, number]>> = {
      pylon_keep: [
        [-8, 0],
        [-8, -10],
        [-8, 10],
      ],
      salk_court: [
        [0, 0],
        [-12, 0],
        [12, 0],
      ],
      assembly: [
        [0, 1],
        [-11, 0],
        [11, 0],
      ],
      hypostyle: [
        [0, 0],
        [-13, 0],
        [0, -13],
      ],
      habitat: [
        [-4, -4],
        [4, -4],
        [-4, 4],
      ],
    };
    for (const kind of KINDS) {
      const t = new Terrain();
      const site = { kind, cx: kind === "pylon_keep" ? -8 : 0, cz: 0 };
      stampStructure(t, site);
      const box = structureExtent(site);
      const inside = walkableInside(t, box);
      expect(inside, `${kind} interior ${inside}`).toBeGreaterThanOrEqual(INTERIOR_MIN);
      const door = doors[kind];
      const reached = flood(t, door[0], door[1], box);
      expect(reached.size, `${kind} flood ${reached.size}`).toBeGreaterThanOrEqual(INTERIOR_MIN);
      for (const [x, z] of rooms[kind]) {
        expect(t.isWall(x, z), `${kind} room ${x},${z} blocked`).toBe(false);
        expect(reached.has(`${x},${z}`), `${kind} cannot reach ${x},${z}`).toBe(true);
      }
    }
  });

  it("keeps structureExtent large enough to cover every pier the stamp writes", () => {
    for (const kind of KINDS) {
      const t = new Terrain();
      const site = { kind, cx: kind === "pylon_keep" ? -8 : 0, cz: 0 };
      stampStructure(t, site);
      const box = structureExtent(site);
      t.forEachWall((x, z, h) => {
        if (h < 1) return;
        expect(
          x >= box.x0 && x <= box.x1 && z >= box.z0 && z <= box.z1,
          `${kind} pier ${x},${z}`,
        ).toBe(true);
      });
    }
  });
});
