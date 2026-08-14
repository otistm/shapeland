import { resolve } from "node:path";
import { defineConfig } from "vite";

const r = (p: string) => resolve(import.meta.dirname, "../..", p);

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@shapeland/sim": r("packages/sim/src/index.ts"),
      "@shapeland/content": r("packages/content/src/index.ts"),
      "@shapeland/tools": r("packages/tools/src/index.ts"),
    },
  },
  esbuild: { target: "es2022" },
  server: { port: 5174 },
  preview: { port: 5174, strictPort: true },
  build: { target: "es2022", sourcemap: true },
});
