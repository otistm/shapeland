import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

const r = (p: string) => resolve(import.meta.dirname, p);

export default defineConfig({
  resolve: {
    alias: {
      "@shapeland/sim": r("packages/sim/src/index.ts"),
      "@shapeland/content": r("packages/content/src/index.ts"),
      "@shapeland/render": r("packages/render/src/index.ts"),
      "@shapeland/ui": r("packages/ui/src/index.ts"),
      "@shapeland/platform": r("packages/platform/src/index.ts"),
      "@shapeland/tools": r("packages/tools/src/index.ts"),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"],
    poolOptions: {
      forks: {
        execArgv: ["--expose-gc"],
      },
    },
  },
});
