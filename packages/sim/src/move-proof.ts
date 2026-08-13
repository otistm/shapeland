import { DIR_E, DIR_N, DIR_S, DIR_W } from "./constants";
import { leapPose, twoRollPose } from "./movement";
import { DIRS, DOWN, PARITY, rollTowardDir } from "./orientation";
import type { ProofLine } from "./orientation-group";

const DIRS4 = [DIR_E, DIR_W, DIR_N, DIR_S] as const;

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

/**
 * Gate proofs for Phase 2: a leap is two rolls, and rolling without pivot
 * locks 12 orientations per cell (1 down face in a corridor).
 */
export function proveMovement(): ProofLine[] {
  const lines: ProofLine[] = [];

  let leapEq = true;
  let n = 0;
  for (let ori = 0; ori < 24; ori++) {
    for (const dir of DIRS4) {
      n += 1;
      const leap = leapPose(0, 0, ori, dir);
      const rolls = twoRollPose(0, 0, ori, dir);
      if (leap.x !== rolls.x || leap.z !== rolls.z || leap.ori !== rolls.ori) leapEq = false;
    }
  }
  log(lines, leapEq, `leap ≡ two rolls (cell + orientation) on ${n} (ori × dir) cases`);

  const R = 9;
  const seen = new Set<string>();
  const queue: Array<[number, number, number]> = [[0, 0, 0]];
  seen.add("0,0,0");
  const steps = [DIRS.E, DIRS.W, DIRS.N, DIRS.S];
  for (let q = 0; q < queue.length; q++) {
    const cur = queue[q];
    if (!cur) continue;
    const [x, z, o] = cur;
    for (const step of steps) {
      const nx = x + step.dx;
      const nz = z + step.dz;
      if (nx > R || nx < -R || nz > R || nz < -R) continue;
      const no = step.roll[o];
      if (no === undefined) continue;
      const key = `${nx},${nz},${no}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push([nx, nz, no]);
      }
    }
  }
  const perCell = new Map<string, Set<number>>();
  for (const key of seen) {
    const parts = key.split(",");
    const cell = `${parts[0]},${parts[1]}`;
    let set = perCell.get(cell);
    if (!set) {
      set = new Set();
      perCell.set(cell, set);
    }
    set.add(Number(parts[2]));
  }
  const sizes = new Set([...perCell.values()].map((s) => s.size));
  log(
    lines,
    sizes.size === 1 && sizes.has(12),
    `orientation lock (rolls only): ${[...sizes]} orientations per cell on 19×19`,
  );

  const corridor = new Set<string>();
  const cq: Array<[number, number]> = [[0, 0]];
  corridor.add("0:0");
  for (let i = 0; i < cq.length; i++) {
    const cur = cq[i];
    if (!cur) continue;
    const [x, o] = cur;
    for (const dir of [DIR_E, DIR_W] as const) {
      const nx = x + (dir === DIR_E ? 1 : -1);
      if (nx > 8 || nx < -8) continue;
      const no = rollTowardDir(o, dir);
      const key = `${nx}:${no}`;
      if (!corridor.has(key)) {
        corridor.add(key);
        cq.push([nx, no]);
      }
    }
  }
  const atZero = new Set<number>();
  const downs = new Set<number>();
  for (const key of corridor) {
    const parts = key.split(":");
    if (parts[0] === "0") {
      const o = Number(parts[1]);
      atZero.add(o);
      downs.add(DOWN(o));
    }
  }
  log(
    lines,
    atZero.size === 1 && downs.size === 1,
    `1-wide corridor without pivot: ${atZero.size} orientation, ${downs.size} down face at origin`,
  );

  const pivotSeen = new Set<number>([0]);
  const pq = [0];
  for (let i = 0; i < pq.length; i++) {
    const o = pq[i];
    if (o === undefined) continue;
    for (const dir of DIRS4) {
      const nOri = rollTowardDir(o, dir);
      if (!pivotSeen.has(nOri)) {
        pivotSeen.add(nOri);
        pq.push(nOri);
      }
    }
  }
  const pivotDowns = new Set<number>();
  for (const o of pivotSeen) pivotDowns.add(DOWN(o));
  log(
    lines,
    pivotSeen.size === 24 && pivotDowns.size === 6,
    `isolated cell with pivot: ${pivotSeen.size}/24 orientations, ${pivotDowns.size}/6 down faces`,
  );

  let parityOk = true;
  for (const key of seen) {
    const parts = key.split(",");
    const x = Number(parts[0]);
    const z = Number(parts[1]);
    const o = Number(parts[2]);
    const even = ((x + z) & 1) === 0;
    if ((PARITY[o] ?? 0) !== (even ? 1 : -1)) parityOk = false;
  }
  log(lines, parityOk, "rolls-only BFS still obeys checkerboard parity");

  return lines;
}

export function assertMovement(): void {
  const failed = proveMovement().filter((line) => !line.ok);
  if (failed.length) throw new Error(failed.map((line) => line.message).join("\n"));
}
