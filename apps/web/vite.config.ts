import { resolve } from "node:path";
import { defineConfig } from "vite";

const r = (p: string) => resolve(import.meta.dirname, "../..", p);

export default defineConfig({
  base: "./",
  resolve: {
    alias: {
      "@shapeland/sim": r("packages/sim/src/index.ts"),
      "@shapeland/content": r("packages/content/src/index.ts"),
      "@shapeland/render": r("packages/render/src"),
      "@shapeland/ui": r("packages/ui/src/index.ts"),
      "@shapeland/platform": r("packages/platform/src/index.ts"),
    },
  },
  optimizeDeps: {
    include: ["three", "three/webgpu", "three/tsl"],
    esbuildOptions: { target: "es2022" },
  },
  esbuild: { target: "es2022" },
  server: { port: 5173 },
  preview: { port: 4173, strictPort: true },
  build: {
    target: "es2022",
    sourcemap: true,
    chunkSizeWarningLimit: 900,
  },
});
