import { DT, MAX_FRAME, MAX_STEPS } from "./constants";
import { type InputLog, cloneLog, maskAt, recordMask } from "./input";
import { type SimSnapshot, copySnapshot, createSnapshot } from "./snapshot";
import { World, type WorldConfig } from "./world";

export interface LoopConfig extends WorldConfig {}

export class SimLoop {
  readonly world: World;
  readonly log: InputLog = [];
  private acc = 0;
  private pendingMask = 0;
  readonly prev = createSnapshot();
  readonly cur = createSnapshot();

  constructor(config: LoopConfig) {
    this.world = new World(config);
    this.world.capture(this.cur);
    copySnapshot(this.cur, this.prev);
  }

  get tick(): number {
    return this.world.tick;
  }

  get alpha(): number {
    const a = this.acc / DT;
    if (a < 0) return 0;
    if (a > 1) return 1;
    return a;
  }

  hold(mask: number): void {
    this.pendingMask = mask | 0;
  }

  /** Advance exactly one sim tick. Used by replay and tests. */
  stepTick(mask = this.pendingMask): void {
    copySnapshot(this.cur, this.prev);
    recordMask(this.log, this.world.tick + 1, mask);
    this.world.step(mask);
    this.world.capture(this.cur);
  }

  /**
   * Consume wall-clock dt produced by the renderer. The integer tick is the only
   * sim clock; leftover `acc` is frame remainder, never accumulated sim time.
   */
  frame(dt: number): number {
    const frameTime = dt > MAX_FRAME ? MAX_FRAME : dt;
    this.acc += frameTime;
    let steps = 0;
    while (this.acc >= DT && steps < MAX_STEPS) {
      this.stepTick(this.pendingMask);
      this.acc -= DT;
      steps += 1;
    }
    if (steps >= MAX_STEPS) this.acc = 0;
    return steps;
  }

  snapshot(): SimSnapshot {
    return this.cur;
  }
}

export function runTicks(config: LoopConfig, ticks: number, log: InputLog = []): SimLoop {
  const loop = new SimLoop(config);
  for (let t = 0; t < ticks; t++) {
    loop.stepTick(maskAt(log, t + 1));
  }
  return loop;
}

export function cloneRecordedLog(loop: SimLoop): InputLog {
  return cloneLog(loop.log);
}
