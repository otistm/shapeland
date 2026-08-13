import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { recordReplay } from "@shapeland/sim";
import { GOLDEN_HASH_EVERY, GOLDEN_IDLE_SEED, GOLDEN_IDLE_TICKS } from "./budget";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus", "idle-240.json");
mkdirSync(dirname(out), { recursive: true });
const replay = recordReplay(
  GOLDEN_IDLE_SEED,
  hashContent(EMPTY_CONTENT),
  GOLDEN_IDLE_TICKS,
  [],
  GOLDEN_HASH_EVERY,
);
writeFileSync(out, `${JSON.stringify(replay, null, 2)}\n`);
console.log(`wrote ${out} (${replay.tickHashes.length} hashes)`);
