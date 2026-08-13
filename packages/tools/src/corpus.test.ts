import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { EMPTY_CONTENT, hashContent } from "@shapeland/content";
import { type Replay, replayAndCheck } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { GOLDEN_IDLE_SEED, GOLDEN_IDLE_TICKS, GOLDEN_ROLL_TICKS } from "./budget";
import { runProofs } from "./prove";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");

describe("proof runner", () => {
  it("exits clean on the cube-group and movement proofs", () => {
    expect(runProofs(() => {})).toBe(0);
  });
});

describe("golden corpus", () => {
  it("replays the committed idle run", () => {
    const replay = JSON.parse(readFileSync(join(ROOT, "idle-240.json"), "utf8")) as Replay;
    expect(replay.seed).toBe(GOLDEN_IDLE_SEED);
    expect(replay.contentHash).toBe(hashContent(EMPTY_CONTENT));
    expect(replay.tickHashes[replay.tickHashes.length - 1]?.tick).toBe(GOLDEN_IDLE_TICKS);
    expect(replayAndCheck(replay)).toBeUndefined();
  });

  it("replays a held-east roll", () => {
    const replay = JSON.parse(readFileSync(join(ROOT, "roll-east-120.json"), "utf8")) as Replay;
    expect(replay.tickHashes[replay.tickHashes.length - 1]?.tick).toBe(GOLDEN_ROLL_TICKS);
    expect(replayAndCheck(replay)).toBeUndefined();
  });
});
