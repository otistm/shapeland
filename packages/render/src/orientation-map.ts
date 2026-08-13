import { orientationMatrix } from "@shapeland/sim";

/** Rx(−90): sim (x,y,z) → game (x, z, −y). */
const S = [1, 0, 0, 0, 0, 1, 0, -1, 0];
const SINV = [1, 0, 0, 0, 0, -1, 0, 1, 0];

function mul(A: readonly number[], B: readonly number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      out[i * 3 + j] =
        (A[i * 3] ?? 0) * (B[j] ?? 0) +
        (A[i * 3 + 1] ?? 0) * (B[3 + j] ?? 0) +
        (A[i * 3 + 2] ?? 0) * (B[6 + j] ?? 0);
    }
  }
  return out;
}

function apply(M: readonly number[], v: readonly number[]): [number, number, number] {
  return [
    (M[0] ?? 0) * (v[0] ?? 0) + (M[1] ?? 0) * (v[1] ?? 0) + (M[2] ?? 0) * (v[2] ?? 0),
    (M[3] ?? 0) * (v[0] ?? 0) + (M[4] ?? 0) * (v[1] ?? 0) + (M[5] ?? 0) * (v[2] ?? 0),
    (M[6] ?? 0) * (v[0] ?? 0) + (M[7] ?? 0) * (v[1] ?? 0) + (M[8] ?? 0) * (v[2] ?? 0),
  ];
}

/** Game-space body→world matrix for a sim orientation. */
export function gameRotation(orientation: number): number[] {
  return mul(S, mul(orientationMatrix(orientation), SINV));
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export function quatFromMat3(M: readonly number[]): Quat {
  const m00 = M[0] ?? 0;
  const m01 = M[1] ?? 0;
  const m02 = M[2] ?? 0;
  const m10 = M[3] ?? 0;
  const m11 = M[4] ?? 0;
  const m12 = M[5] ?? 0;
  const m20 = M[6] ?? 0;
  const m21 = M[7] ?? 0;
  const m22 = M[8] ?? 0;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return { w: 0.25 / s, x: (m21 - m12) * s, y: (m02 - m20) * s, z: (m10 - m01) * s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

export function orientationQuaternion(orientation: number): Quat {
  return quatFromMat3(gameRotation(orientation));
}

/**
 * BoxGeometry groups are +X,−X,+Y,−Y,+Z,−Z.
 * After Rx(−90), those local faces show sim faces +X,−X,+Z,−Z,−Y,+Y.
 */
export const SIM_FACE_FOR_GROUP = [2, 3, 0, 1, 5, 4] as const;

const LOCAL_NORMALS: readonly (readonly number[])[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

/** Which BoxGeometry group is world-up after applying the game rotation. */
export function upGroup(orientation: number): number {
  const R = gameRotation(orientation);
  let best = 0;
  let bestY = Number.NEGATIVE_INFINITY;
  for (let g = 0; g < 6; g++) {
    const n = LOCAL_NORMALS[g];
    if (!n) continue;
    const w = apply(R, n);
    if (w[1] > bestY) {
      bestY = w[1];
      best = g;
    }
  }
  return best;
}

export function rotateVec(M: readonly number[], v: readonly number[]): [number, number, number] {
  return apply(M, v);
}
