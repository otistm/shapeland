import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Vercel looks for `dist` at the git root even when Root Directory is apps/web. */
if (!process.env.VERCEL) process.exit(0);

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(webRoot, "dist");
const to = resolve(webRoot, "../../dist");
if (!existsSync(from)) {
  console.error("apps/web/dist missing after vite build");
  process.exit(1);
}
mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
