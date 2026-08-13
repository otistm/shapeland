import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { BUTTON_E, recordReplay } from "@shapeland/sim";
import {
  GOLDEN_HASH_EVERY,
  GOLDEN_IDLE_SEED,
  GOLDEN_IDLE_TICKS,
  GOLDEN_ROLL_TICKS,
} from "./budget";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
mkdirSync(dir, { recursive: true });
const contentHash = hashContent(EMPTY_CONTENT);

function write(name: string, ticks: number, log: { tick: number; mask: number }[]): void {
  const replay = recordReplay(GOLDEN_IDLE_SEED, contentHash, ticks, log, GOLDEN_HASH_EVERY);
  const out = join(dir, name);
  writeFileSync(out, `${JSON.stringify(replay, null, 2)}\n`);
  console.log(`wrote ${out} (${replay.tickHashes.length} hashes)`);
}

write("idle-240.json", GOLDEN_IDLE_TICKS, []);
write("roll-east-120.json", GOLDEN_ROLL_TICKS, [{ tick: 1, mask: BUTTON_E }]);
