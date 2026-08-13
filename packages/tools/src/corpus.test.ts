import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { type Replay, replayAndCheck } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { GOLDEN_IDLE_SEED, GOLDEN_IDLE_TICKS } from "./budget";
import { runProofs } from "./prove";

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus", "idle-240.json");

describe("proof runner", () => {
  it("exits clean on the cube-group suite", () => {
    expect(runProofs(() => {})).toBe(0);
  });
});

describe("golden corpus", () => {
  it("replays the committed idle run", () => {
    const replay = JSON.parse(readFileSync(CORPUS, "utf8")) as Replay;
    expect(replay.seed).toBe(GOLDEN_IDLE_SEED);
    expect(replay.contentHash).toBe(hashContent(EMPTY_CONTENT));
    expect(replay.tickHashes[replay.tickHashes.length - 1]?.tick).toBe(GOLDEN_IDLE_TICKS);
    expect(replayAndCheck(replay)).toBeUndefined();
  });
});
