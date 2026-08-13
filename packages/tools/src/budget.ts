export const HEAP_DELTA_BUDGET = 2 * 1024 * 1024;
export const ALLOCATION_TICKS = 10_000;
export const GOLDEN_IDLE_TICKS = 240;
export const GOLDEN_IDLE_SEED = 1;
export const GOLDEN_HASH_EVERY = 24;

/** Frame budget ledger. Additions must declare a line here. */
export const FRAME_BUDGET_MS = {
  simTick: 8,
  render: 8,
} as const;
