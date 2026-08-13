import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SIM_SRC = join(dirname(fileURLToPath(import.meta.url)));

const FORBIDDEN = [
  { re: /Math\.(sin|cos|tan|asin|acos|atan|atan2|exp|log|pow|random)\b/, name: "unspecified Math" },
  { re: /\bDate\.(now|parse|UTC)\b/, name: "Date" },
  { re: /\bnew Date\b/, name: "new Date" },
  { re: /\bperformance\b/, name: "performance" },
  { re: /\bdocument\b/, name: "document" },
  { re: /\bwindow\b/, name: "window" },
  { re: /from\s+['"]three['"]/, name: "three" },
];

function walk(dir: string, files: string[]): void {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, files);
    else if (name.endsWith(".ts") && !name.endsWith(".test.ts")) files.push(path);
  }
}

describe("sim purity", () => {
  it("does not import DOM, Three.js, clocks, or unspecified math", () => {
    const files: string[] = [];
    walk(SIM_SRC, files);
    const hits: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const rule of FORBIDDEN) {
        if (rule.re.test(src)) hits.push(`${file}: ${rule.name}`);
      }
    }
    expect(hits).toEqual([]);
  });
});
