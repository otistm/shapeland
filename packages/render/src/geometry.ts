import type { BufferGeometry } from "three/webgpu";

/** Exactly one call site in the package. File-audit tests grep for this name. */
export function toNonIndexedFacets(geo: BufferGeometry): BufferGeometry {
  const faceted = geo.index ? geo.toNonIndexed() : geo;
  faceted.computeVertexNormals();
  return faceted;
}
