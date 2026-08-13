import type { SimSnapshot } from "@shapeland/sim";

export interface InterpolatedPlayer {
  x: number;
  y: number;
  z: number;
  orientation: number;
}

export interface InterpolatedFrame {
  alpha: number;
  tick: number;
  player: InterpolatedPlayer;
}

/** Snapshots are read-only. Cell pose is lerped; orientation stays discrete. */
export function interpolate(prev: SimSnapshot, cur: SimSnapshot, alpha: number): InterpolatedFrame {
  const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  return {
    alpha: t,
    tick: cur.tick,
    player: {
      x: prev.player.x + (cur.player.x - prev.player.x) * t,
      y: prev.player.y + (cur.player.y - prev.player.y) * t,
      z: prev.player.z + (cur.player.z - prev.player.z) * t,
      orientation: cur.player.orientation,
    },
  };
}
