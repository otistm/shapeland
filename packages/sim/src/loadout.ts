/** Integer ability ids. Content maps these to kinds; sim never stores strings. */

export const FACE_COUNT = 6;

export const ABILITY_NORMAL = 0;
export const ABILITY_FIRE = 1;
export const ABILITY_LIGHTNING = 2;
export const ABILITY_PHYSICAL = 3;
export const ABILITY_ICE = 4;
export const ABILITY_MAX = 4;

export const SANDBOX_FINDS =
  (1 << ABILITY_FIRE) | (1 << ABILITY_LIGHTNING) | (1 << ABILITY_PHYSICAL) | (1 << ABILITY_ICE);

export function abilityFound(found: number, id: number): boolean {
  if (id === ABILITY_NORMAL) return true;
  if (id < 1 || id > ABILITY_MAX) return false;
  return (found & (1 << id)) !== 0;
}

export function grantAbility(found: number, id: number): number {
  if (id < 1 || id > ABILITY_MAX) return found;
  return found | (1 << id);
}

export function facesLegal(faces: ArrayLike<number>, found: number): boolean {
  if (faces.length !== FACE_COUNT) return false;
  for (let i = 0; i < FACE_COUNT; i++) {
    const a = faces[i] ?? -1;
    if (a !== (a | 0) || a < 0 || a > ABILITY_MAX) return false;
    if (!abilityFound(found, a)) return false;
  }
  return true;
}

/** True when two non-normal abilities sit on opposite faces of one axis. */
export function axisClash(faces: ArrayLike<number>): boolean {
  for (let i = 0; i < FACE_COUNT; i += 2) {
    const a = faces[i] ?? 0;
    const b = faces[i ^ 1] ?? 0;
    if (a !== ABILITY_NORMAL && b !== ABILITY_NORMAL) return true;
  }
  return false;
}

export function armedCount(faces: ArrayLike<number>): number {
  let n = 0;
  for (let i = 0; i < faces.length; i++) {
    if ((faces[i] ?? 0) !== ABILITY_NORMAL) n += 1;
  }
  return n;
}

export function copyFaces(
  src: ArrayLike<number>,
  dest: { [i: number]: number; length: number },
): void {
  for (let i = 0; i < FACE_COUNT; i++) dest[i] = src[i] ?? ABILITY_NORMAL;
}

export const LOADOUT_SAVE_VERSION = 1;

export interface LoadoutSave {
  version: number;
  faces: number[];
  found: number;
}

/**
 * Restore finds always. Commit faces only when every equipped ability was found.
 * An illegal equip is dropped; legitimate finds still apply.
 */
export function parseLoadout(raw: unknown): { found: number; faces: number[] | null } {
  const empty = { found: 0, faces: null as number[] | null };
  if (raw === null || typeof raw !== "object") return empty;
  const rec = raw as { version?: unknown; faces?: unknown; found?: unknown };
  let found = 0;
  if (typeof rec.found === "number" && rec.found === (rec.found | 0)) {
    found = rec.found & SANDBOX_FINDS;
  } else if (Array.isArray(rec.found)) {
    for (const id of rec.found) {
      if (typeof id === "number") found = grantAbility(found, id);
    }
  }
  if (!Array.isArray(rec.faces)) return { found, faces: null };
  const faces = rec.faces.map((n) => (typeof n === "number" ? n | 0 : -1));
  if (!facesLegal(faces, found)) return { found, faces: null };
  return { found, faces };
}

export function serializeLoadout(faces: ArrayLike<number>, found: number): LoadoutSave {
  return {
    version: LOADOUT_SAVE_VERSION,
    faces: [
      faces[0] ?? 0,
      faces[1] ?? 0,
      faces[2] ?? 0,
      faces[3] ?? 0,
      faces[4] ?? 0,
      faces[5] ?? 0,
    ],
    found,
  };
}
