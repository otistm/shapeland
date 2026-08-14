/** Allowed `@shapeland/*` imports. Crossing a boundary requires updating this map. */

export const PACKAGE_GRAPH: Record<string, readonly string[]> = {
  sim: [],
  content: ["sim"],
  render: ["sim", "content"],
  ui: ["sim", "content"],
  platform: ["sim"],
  tools: ["sim", "content", "render", "ui", "platform"],
  web: ["sim", "content", "render", "ui", "platform"],
  terrain: ["sim", "tools"],
};

const IMPORT_RE = /from\s+["']@shapeland\/([a-z]+)(?:\/[^"']+)?["']/g;

export function importedPackages(source: string): string[] {
  const found = new Set<string>();
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null = IMPORT_RE.exec(source);
  while (m) {
    const name = m[1];
    if (name) found.add(name);
    m = IMPORT_RE.exec(source);
  }
  return [...found];
}

export function forbiddenImports(fromPackage: string, source: string): string[] {
  const allowed = PACKAGE_GRAPH[fromPackage];
  if (!allowed) return [`unknown package ${fromPackage}`];
  return importedPackages(source).filter((name) => name !== fromPackage && !allowed.includes(name));
}
