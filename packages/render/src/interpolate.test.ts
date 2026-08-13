import type { SimSnapshot } from "@shapeland/sim";
import { createSnapshot } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { interpolate } from "./interpolate";

describe("render interpolator", () => {
  it("reads snapshots without mutating them", () => {
    const prev = createSnapshot();
    const cur = createSnapshot();
    cur.tick = 4;
    cur.player.x = 0;
    const frozen: SimSnapshot = {
      tick: prev.tick,
      seed: prev.seed,
      contentHash: prev.contentHash,
      integrity: prev.integrity,
      player: { ...prev.player },
      hashes: { ...prev.hashes },
    };
    interpolate(prev, cur, 0.5);
    expect(prev).toEqual(frozen);
  });
});
