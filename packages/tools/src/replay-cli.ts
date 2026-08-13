import { readFileSync, writeFileSync } from "node:fs";
import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { type Replay, recordReplay, replayAndCheck, toBugReport } from "@shapeland/sim";

function usage(): never {
  console.error(`Usage:
  pnpm replay --record <seed> <ticks> <out.json>
  pnpm replay --check <replay.json>`);
  process.exit(2);
}

function parse(): void {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (cmd === "--record") {
    const seed = Number(argv[1]);
    const ticks = Number(argv[2]);
    const out = argv[3];
    if (!Number.isFinite(seed) || !Number.isFinite(ticks) || !out) usage();
    const replay = recordReplay(seed, hashContent(EMPTY_CONTENT), ticks, [], 1);
    writeFileSync(out, `${JSON.stringify(replay, null, 2)}\n`);
    const report = toBugReport(replay);
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  if (cmd === "--check") {
    const path = argv[1];
    if (!path) usage();
    const replay = JSON.parse(readFileSync(path, "utf8")) as Replay;
    const mismatch = replayAndCheck(replay);
    if (mismatch) {
      console.error(
        `divergence at tick ${mismatch.tick} layer ${mismatch.layer}: expected ${mismatch.expected} got ${mismatch.actual}`,
      );
      process.exit(1);
    }
    console.log(`replay ok  seed=${replay.seed} hashes=${replay.tickHashes.length}`);
    return;
  }
  usage();
}

parse();
