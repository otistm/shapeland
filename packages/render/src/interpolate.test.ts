import { copySnapshot, createSnapshot } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { interpolate } from "./interpolate";

describe("render interpolator", () => {
  it("reads snapshots without mutating them", () => {
    const prev = createSnapshot();
    const cur = createSnapshot();
    cur.tick = 4;
    cur.player.x = 0;
    const frozen = createSnapshot();
    copySnapshot(prev, frozen);
    interpolate(prev, cur, 0.5);
    expect(prev).toEqual(frozen);
  });
});
