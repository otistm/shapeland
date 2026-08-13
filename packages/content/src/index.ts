import { hashU32s } from "@shapeland/sim";

export const CONTENT_SCHEMA_VERSION = 1;

export interface WorldContent {
  version: number;
  id: string;
}

export const EMPTY_CONTENT: WorldContent = {
  version: CONTENT_SCHEMA_VERSION,
  id: "empty",
};

export function hashContent(content: WorldContent): number {
  let n = 0;
  for (let i = 0; i < content.id.length; i++) n = (n + content.id.charCodeAt(i)) | 0;
  return hashU32s([0x5a1ec07e, content.version, n]);
}

export {
  ABILITY_CSS,
  ABILITY_LABEL,
  ABILITY_LINE,
  ID_BY_KIND,
  KIND_BY_ID,
  kindOf,
} from "./abilities";
export {
  ABILITY_KINDS,
  FACE_SIZE,
  drawAbilityFace,
  type AbilityKind,
  type FaceBrush,
} from "./faces";
