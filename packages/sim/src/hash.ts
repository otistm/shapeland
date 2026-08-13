const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1aStart(): number {
  return FNV_OFFSET >>> 0;
}

export function fnv1aU8(h: number, byte: number): number {
  return Math.imul(h ^ (byte & 0xff), FNV_PRIME) >>> 0;
}

export function fnv1aU32(h: number, n: number): number {
  const v = n >>> 0;
  let acc = fnv1aU8(h, v);
  acc = fnv1aU8(acc, v >>> 8);
  acc = fnv1aU8(acc, v >>> 16);
  return fnv1aU8(acc, v >>> 24);
}

export function fnv1aI32(h: number, n: number): number {
  return fnv1aU32(h, n | 0);
}

export function fnv1aBytes(h: number, view: ArrayBufferView): number {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  let acc = h;
  for (let i = 0; i < bytes.length; i++) {
    acc = fnv1aU8(acc, bytes[i] ?? 0);
  }
  return acc;
}

export function hashU32s(nums: readonly number[]): number {
  let h = fnv1aStart();
  for (const n of nums) h = fnv1aU32(h, n);
  return h;
}

const F64_BUF = new ArrayBuffer(8);
const F64_VIEW = new DataView(F64_BUF);
const F64_BYTES = new Uint8Array(F64_BUF);

/** Hash an IEEE-754 double. Rejects NaN; normalizes −0. */
export function fnv1aF64(h: number, n: number): number {
  if (Number.isNaN(n)) throw new Error("NaN cannot be hashed");
  F64_VIEW.setFloat64(0, n === 0 ? 0 : n, true);
  let acc = h;
  for (let i = 0; i < 8; i++) acc = fnv1aU8(acc, F64_BYTES[i] ?? 0);
  return acc;
}

export function hex32(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}
