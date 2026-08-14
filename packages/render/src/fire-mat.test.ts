import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RENDER_SRC = dirname(fileURLToPath(import.meta.url));

describe("qa-vfx fire clock", () => {
  it("does not import TSL time and dirties the UBO through onFrameUpdate", () => {
    const src = readFileSync(join(RENDER_SRC, "fire-mat.ts"), "utf8");
    const imports = src.slice(0, src.indexOf('} from "three/tsl";'));
    expect(/\btime\b/.test(imports)).toBe(false);
    expect(src.includes("onFrameUpdate")).toBe(true);
    expect(src.includes("positionNode")).toBe(false);
  });

  it("is advanced from the vfx present loop so reduced motion freezes the plume", () => {
    const src = readFileSync(join(RENDER_SRC, "vfx.ts"), "utf8");
    expect(src.includes("fire.setClock(reduced ? 0 : clock)")).toBe(true);
  });
});
