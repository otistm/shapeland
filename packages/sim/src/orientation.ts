/**
 * Canonical cube orientations. Face order is Z-up sim space:
 *   0=+Z  1=−Z  2=+X  3=−X  4=+Y  5=−Y
 * so opposite(f) === f ^ 1 and upFace(i) === i >> 2.
 *
 * Render remaps this integer to a Y-up quaternion. Do not reindex here.
 */

const ORI_COUNT = 24;

function at(table: readonly number[], i: number): number {
  const v = table[i];
  if (v === undefined) throw new Error(`orientation out of range: ${i}`);
  return v;
}

export const UP = (i: number): number => i >> 2;
export const OPPOSITE = (f: number): number => f ^ 1;
export const YAW = (i: number): number => (i & ~3) | ((i + 1) & 3);
export const DOWN = (i: number): number => UP(i) ^ 1;

export const ROLL_E = [
  12, 17, 10, 23, 14, 21, 8, 19, 0, 16, 4, 20, 6, 18, 2, 22, 15, 5, 11, 3, 13, 1, 9, 7,
] as const;
export const ROLL_W = [
  8, 21, 14, 19, 10, 17, 12, 23, 6, 22, 2, 18, 0, 20, 4, 16, 9, 1, 13, 7, 11, 5, 15, 3,
] as const;
export const ROLL_N = [
  20, 13, 18, 11, 16, 15, 22, 9, 21, 1, 17, 5, 23, 7, 19, 3, 0, 12, 6, 8, 4, 14, 2, 10,
] as const;
export const ROLL_S = [
  16, 9, 22, 15, 20, 11, 18, 13, 19, 7, 23, 3, 17, 1, 21, 5, 4, 10, 2, 14, 0, 8, 6, 12,
] as const;

export const PARITY = [
  1, -1, 1, -1, 1, -1, 1, -1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1,
] as const;

export const PIPS = [6, 1, 3, 4, 2, 5] as const;

export type Cardinal = "E" | "W" | "N" | "S";

export const DIRS: Record<Cardinal, { dx: number; dz: number; roll: readonly number[] }> = {
  E: { dx: 1, dz: 0, roll: ROLL_E },
  W: { dx: -1, dz: 0, roll: ROLL_W },
  N: { dx: 0, dz: -1, roll: ROLL_N },
  S: { dx: 0, dz: 1, roll: ROLL_S },
};

export function rollToward(orientation: number, dir: Cardinal): number {
  return at(DIRS[dir].roll, orientation);
}

export function parityOf(orientation: number): number {
  return at(PARITY, orientation);
}

export function cellParity(x: number, z: number): number {
  return ((x + z) & 1) === 0 ? 1 : -1;
}

export function assertOrientationTables(): void {
  if (ROLL_E.length !== ORI_COUNT || ROLL_W.length !== ORI_COUNT) {
    throw new Error("roll tables must have 24 entries");
  }
  for (let i = 0; i < ORI_COUNT; i++) {
    if (at(ROLL_W, at(ROLL_E, i)) !== i) throw new Error(`ROLL_W is not inverse of ROLL_E at ${i}`);
    if (at(ROLL_S, at(ROLL_N, i)) !== i) throw new Error(`ROLL_S is not inverse of ROLL_N at ${i}`);
    const p = at(PARITY, i);
    if (at(PARITY, at(ROLL_E, i)) !== -p) throw new Error(`ROLL_E does not flip parity at ${i}`);
    if (at(PARITY, at(ROLL_W, i)) !== -p) throw new Error(`ROLL_W does not flip parity at ${i}`);
    if (at(PARITY, at(ROLL_N, i)) !== -p) throw new Error(`ROLL_N does not flip parity at ${i}`);
    if (at(PARITY, at(ROLL_S, i)) !== -p) throw new Error(`ROLL_S does not flip parity at ${i}`);
    if (DOWN(i) !== (UP(i) ^ 1)) throw new Error(`down is not opposite of up at ${i}`);
    const yawed = YAW(i);
    if (UP(yawed) !== UP(i)) throw new Error(`yaw changed up-face at ${i}`);
  }
  for (let f = 0; f < 6; f++) {
    const a = PIPS[f];
    const b = PIPS[f ^ 1];
    if (a === undefined || b === undefined || a + b !== 7) {
      throw new Error(`pip involution failed at face ${f}`);
    }
  }
}
