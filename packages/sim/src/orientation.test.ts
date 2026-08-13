import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DIRS,
  PARITY,
  UP,
  YAW,
  assertOrientationTables,
  cellParity,
  rollToward,
} from "./orientation";
import { assertCubeGroup, proveCubeGroup } from "./orientation-group";

describe("cube orientation group", () => {
  it("boot-time table identities hold", () => {
    expect(() => assertOrientationTables()).not.toThrow();
  });

  it("proves the rotation group, parity theorem, and PIVOT restoration", () => {
    const lines = proveCubeGroup();
    const failed = lines.filter((line) => !line.ok).map((line) => line.message);
    expect(failed).toEqual([]);
    expect(() => assertCubeGroup()).not.toThrow();
  });

  it("up-face is the high bits and yaw stays on that face", () => {
    for (let i = 0; i < 24; i++) {
      expect(UP(i)).toBe(i >> 2);
      expect(UP(YAW(i))).toBe(UP(i));
    }
  });

  it("a roll onto a neighboring cell matches checkerboard parity", () => {
    expect(PARITY[0]).toBe(cellParity(0, 0));
    expect(cellParity(1, 0)).toBe(-1);
    expect(DIRS.N.dz).toBe(-1);
    expect(DIRS.S.dz).toBe(1);
    for (let i = 0; i < 24; i++) {
      const p = PARITY[i] ?? 0;
      expect(PARITY[rollToward(i, "E")]).toBe(-p);
    }
  });
});

describe("legacy verifier", () => {
  it("still exists as the research script and stays in sync with the tables", () => {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const src = readFileSync(join(root, "tools", "verify-cube-group.mjs"), "utf8");
    expect(src.includes("rotation group")).toBe(true);
  });
});
