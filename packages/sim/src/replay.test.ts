import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { BUTTON_E, DT } from "./constants";
import { hex32 } from "./hash";
import { SimLoop } from "./loop";
import { recordReplay, replayAndCheck, toBugReport } from "./replay";
import { snapshotsEqual } from "./snapshot";
import { World } from "./world";

const SEED = 1;
const CONTENT = 0xc0ffee;

describe("fixed timestep", () => {
  it("uses the integer tick as the only clock", () => {
    const loop = new SimLoop({ seed: SEED, contentHash: CONTENT });
    expect(loop.tick).toBe(0);
    loop.frame(DT);
    expect(loop.tick).toBe(1);
    loop.frame(DT * 3);
    expect(loop.tick).toBe(4);
  });

  it("caps spiral-of-death catch-up at MAX_STEPS", () => {
    const loop = new SimLoop({ seed: SEED, contentHash: CONTENT });
    const steps = loop.frame(2);
    expect(steps).toBe(8);
    expect(loop.tick).toBe(8);
  });

  it("1-step frames and batched frames hash identically", () => {
    const a = new SimLoop({ seed: SEED, contentHash: CONTENT });
    const b = new SimLoop({ seed: SEED, contentHash: CONTENT });
    for (let i = 0; i < 24; i++) a.frame(DT);
    b.frame(DT * 8);
    b.frame(DT * 8);
    b.frame(DT * 8);
    expect(snapshotsEqual(a.cur, b.cur)).toBe(true);
  });
});

describe("replay", () => {
  it("is byte-identical across two recordings of the same seed and log", () => {
    const log = [
      { tick: 10, mask: BUTTON_E },
      { tick: 40, mask: 0 },
    ];
    const a = recordReplay(SEED, CONTENT, 120, log, 1);
    const b = recordReplay(SEED, CONTENT, 120, log, 1);
    expect(a.tickHashes).toEqual(b.tickHashes);
    expect(replayAndCheck(a)).toBeUndefined();
    const report = toBugReport(a);
    expect(report.seed).toBe(SEED);
    expect(report.contentHash).toBe(hex32(CONTENT));
    expect(report.inputLog).toEqual(log);
  });

  it("layered hashes diverge on the input layer when the log changes", () => {
    const idle = recordReplay(SEED, CONTENT, 30, [], 1);
    const held = recordReplay(SEED, CONTENT, 30, [{ tick: 1, mask: BUTTON_E }], 1);
    const lastIdle = idle.tickHashes[idle.tickHashes.length - 1];
    const lastHeld = held.tickHashes[held.tickHashes.length - 1];
    expect(lastIdle?.hashes.player).toBe(lastHeld?.hashes.player);
    expect(lastIdle?.hashes.input).not.toBe(lastHeld?.hashes.input);
    expect(lastIdle?.hashes.total).not.toBe(lastHeld?.hashes.total);
  });

  it("replays random (seed, log) pairs identically", () => {
    fc.assert(
      fc.property(
        fc.integer(),
        fc.array(
          fc.record({
            tick: fc.integer({ min: 1, max: 80 }),
            mask: fc.integer({ min: 0, max: 63 }),
          }),
          { maxLength: 12 },
        ),
        (seed, events) => {
          const log = [...events].sort((a, b) => a.tick - b.tick);
          const a = recordReplay(seed, CONTENT, 80, log, 8);
          const b = recordReplay(seed, CONTENT, 80, log, 8);
          return replayAndCheck(a) === undefined && JSON.stringify(a) === JSON.stringify(b);
        },
      ),
      { numRuns: 25 },
    );
  });
});

describe("budget", () => {
  it("holds a steady heap across 10k ticks", () => {
    const gc = (globalThis as typeof globalThis & { gc?: () => void }).gc;
    const world = new World({ seed: SEED, contentHash: CONTENT });
    for (let i = 0; i < 1000; i++) world.step(0);
    if (typeof gc === "function") gc();
    const before = typeof process !== "undefined" ? process.memoryUsage().heapUsed : 0;
    for (let i = 0; i < 10_000; i++) world.step(0);
    if (typeof gc === "function") gc();
    const after = typeof process !== "undefined" ? process.memoryUsage().heapUsed : 0;
    expect(world.tick).toBe(11_000);
    if (typeof gc === "function") {
      expect(after - before).toBeLessThan(2 * 1024 * 1024);
    }
  });
});
