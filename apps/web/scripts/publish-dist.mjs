import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(webRoot, "dist");
if (!existsSync(from)) {
  console.error("apps/web/dist missing after vite build");
  process.exit(1);
}

// Vercel Root Directory is apps/terrain, so it looks for dist there — not in apps/web.
const dests = [resolve(webRoot, "../../dist"), resolve(process.cwd(), "dist")];
const seen = new Set();
for (const to of dests) {
  if (seen.has(to) || to === from) continue;
  seen.add(to);
  mkdirSync(to, { recursive: true });
  cpSync(from, to, { recursive: true });
  console.log(`publish-dist: ${from} -> ${to}`);
}
