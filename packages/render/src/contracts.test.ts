import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const RENDER_SRC = join(dirname(fileURLToPath(import.meta.url)));

function walk(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(path);
  }
}

describe("render contracts", () => {
  it("has exactly one toNonIndexed call site", () => {
    const files: string[] = [];
    walk(RENDER_SRC, files);
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const n = (src.match(/\.toNonIndexed\(/g) ?? []).length;
      if (n) hits.push(`${file.slice(RENDER_SRC.length + 1)}:${n}`);
    }
    expect(hits).toEqual(["geometry.ts:1"]);
  });

  it("does not construct standard or raw shader materials", () => {
    const files: string[] = [];
    walk(RENDER_SRC, files);
    const banned = /MeshStandard|ShaderMaterial|RawShaderMaterial|onBeforeCompile/;
    const hits = files.filter((file) => banned.test(readFileSync(file, "utf8")));
    expect(hits).toEqual([]);
  });

  it("has exactly one value-noise definition", () => {
    const files: string[] = [];
    walk(RENDER_SRC, files);
    const hits: string[] = [];
    for (const file of files) {
      const n = (readFileSync(file, "utf8").match(/function valueNoise\(/g) ?? []).length;
      if (n) hits.push(`${file.slice(RENDER_SRC.length + 1)}:${n}`);
    }
    expect(hits).toEqual(["tsl-noise.ts:1"]);
  });

  it("labels every impact shake source", () => {
    const files: string[] = [];
    walk(RENDER_SRC, files);
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const calls = src.match(/impactShake\(rig,/g) ?? [];
      const labels = src.match(/\/\/ impact:/g) ?? [];
      if (calls.length > labels.length) {
        hits.push(
          `${file.slice(RENDER_SRC.length + 1)}: ${calls.length} calls, ${labels.length} labels`,
        );
      }
    }
    expect(hits).toEqual([]);
  });

  it("lifts the camera over terrain columns, not structure piers", () => {
    const src = readFileSync(join(RENDER_SRC, "presenter.ts"), "utf8");
    const heightAt = src.slice(src.indexOf("const heightAt"), src.indexOf("let worldClock"));
    expect(heightAt.includes("wallHeight")).toBe(false);
    expect(heightAt.includes("terrain.height")).toBe(true);
    const view = readFileSync(join(RENDER_SRC, "world-view.ts"), "utf8");
    expect(view.includes("pierCutawayDist2")).toBe(true);
  });

  it("never lets traversal write shake", () => {
    const src = readFileSync(join(RENDER_SRC, "camera.ts"), "utf8");
    const step = src.slice(
      src.indexOf("export function stepCamera"),
      src.indexOf("export function lookAtY"),
    );
    expect(step.includes("rig.shake = amount")).toBe(false);
    expect(step.includes("impactShake")).toBe(false);
  });
});
