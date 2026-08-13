const LOADOUT_KEY = "shapeland:loadout";

export function readStore(key: string): string | undefined {
  try {
    if (typeof localStorage === "undefined") return undefined;
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

export function writeStore(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
    /* storage blocked or quota — in-memory only */
  }
}

export function loadLoadoutJson(): string | undefined {
  return readStore(LOADOUT_KEY);
}

export function saveLoadoutJson(json: string): void {
  writeStore(LOADOUT_KEY, json);
}
