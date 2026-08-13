import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PACKAGE_GRAPH, forbiddenImports } from "./boundaries";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const DIRS: Record<string, string> = {
  sim: join(ROOT, "packages", "sim", "src"),
  content: join(ROOT, "packages", "content", "src"),
  render: join(ROOT, "packages", "render", "src"),
  ui: join(ROOT, "packages", "ui", "src"),
  platform: join(ROOT, "packages", "platform", "src"),
  tools: join(ROOT, "packages", "tools", "src"),
  web: join(ROOT, "apps", "web", "src"),
};

function walk(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (name.endsWith(".ts")) files.push(path);
  }
}

describe("package boundaries", () => {
  it("every package is listed in the contract graph", () => {
    expect(Object.keys(PACKAGE_GRAPH).sort()).toEqual(Object.keys(DIRS).sort());
  });

  it("source imports stay inside the allowed graph", () => {
    const violations: string[] = [];
    for (const [pkg, dir] of Object.entries(DIRS)) {
      const files: string[] = [];
      walk(dir, files);
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        for (const bad of forbiddenImports(pkg, src)) {
          violations.push(`${pkg} ← @shapeland/${bad}  (${file.slice(ROOT.length + 1)})`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("package.json dependencies match the contract", () => {
    const violations: string[] = [];
    const pkgJson: Record<string, string> = {
      sim: join(ROOT, "packages", "sim", "package.json"),
      content: join(ROOT, "packages", "content", "package.json"),
      render: join(ROOT, "packages", "render", "package.json"),
      ui: join(ROOT, "packages", "ui", "package.json"),
      platform: join(ROOT, "packages", "platform", "package.json"),
      tools: join(ROOT, "packages", "tools", "package.json"),
      web: join(ROOT, "apps", "web", "package.json"),
    };
    for (const [pkg, path] of Object.entries(pkgJson)) {
      const json = JSON.parse(readFileSync(path, "utf8")) as {
        dependencies?: Record<string, string>;
      };
      const deps = Object.keys(json.dependencies ?? {})
        .filter((name) => name.startsWith("@shapeland/"))
        .map((name) => name.slice("@shapeland/".length));
      const allowed = PACKAGE_GRAPH[pkg] ?? [];
      for (const dep of deps) {
        if (!allowed.includes(dep)) violations.push(`${pkg} package.json depends on ${dep}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
