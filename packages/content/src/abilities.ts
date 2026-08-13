import {
  ABILITY_FIRE,
  ABILITY_ICE,
  ABILITY_LIGHTNING,
  ABILITY_NORMAL,
  ABILITY_PHYSICAL,
  FIRE,
  ICE,
  LIGHTNING,
  NORMAL,
  PHYSICAL,
} from "@shapeland/sim";
import type { AbilityKind } from "./faces";

export const KIND_BY_ID: readonly AbilityKind[] = [
  "normal",
  "fire",
  "lightning",
  "physical",
  "ice",
];

export const ID_BY_KIND: Record<AbilityKind, number> = {
  normal: ABILITY_NORMAL,
  fire: ABILITY_FIRE,
  lightning: ABILITY_LIGHTNING,
  physical: ABILITY_PHYSICAL,
  ice: ABILITY_ICE,
};

export const ABILITY_LABEL: Record<AbilityKind, string> = {
  normal: "Normal",
  fire: "Fire",
  lightning: "Lightning",
  physical: "Physical",
  ice: "Ice",
};

export const ABILITY_LINE: Record<AbilityKind, string> = {
  normal: "Nothing but a puff of dust.",
  fire: "Scorches the ground where it lands.",
  lightning: "Calls a bolt down onto itself.",
  physical: "Cracks the floor and throws rubble.",
  ice: "Freezes a slick patch. Rolling on ice slides without turning.",
};

export const ABILITY_CSS: Record<AbilityKind, string> = {
  normal: NORMAL,
  fire: FIRE,
  lightning: LIGHTNING,
  physical: PHYSICAL,
  ice: ICE,
};

export function kindOf(id: number): AbilityKind {
  return KIND_BY_ID[id] ?? "normal";
}
