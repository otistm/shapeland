export interface InputEvent {
  tick: number;
  mask: number;
}

export type InputLog = InputEvent[];

export function maskAt(log: InputLog, tick: number): number {
  let mask = 0;
  for (let i = 0; i < log.length; i++) {
    const ev = log[i];
    if (!ev || ev.tick > tick) break;
    mask = ev.mask;
  }
  return mask;
}

export function recordMask(log: InputLog, tick: number, mask: number): void {
  const last = log.length === 0 ? undefined : log[log.length - 1];
  if (last && last.mask === mask) return;
  if (last && last.tick === tick) {
    last.mask = mask;
    return;
  }
  log.push({ tick, mask });
}

export function cloneLog(log: InputLog): InputLog {
  const out: InputLog = [];
  for (let i = 0; i < log.length; i++) {
    const ev = log[i];
    if (ev) out.push({ tick: ev.tick, mask: ev.mask });
  }
  return out;
}
