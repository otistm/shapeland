import {
  type Color,
  DataTexture,
  MeshToonNodeMaterial,
  NearestFilter,
  NoColorSpace,
  RGBAFormat,
} from "three/webgpu";
import { toonRampBytes } from "./toon-ramp";

let ramp: DataTexture | undefined;

export function toonRampTexture(): DataTexture {
  if (ramp) return ramp;
  const data = toonRampBytes();
  ramp = new DataTexture(data, 3, 1, RGBAFormat);
  ramp.minFilter = NearestFilter;
  ramp.magFilter = NearestFilter;
  ramp.generateMipmaps = false;
  ramp.colorSpace = NoColorSpace;
  ramp.needsUpdate = true;
  return ramp;
}

export interface ToonOpts {
  color?: number | string | Color;
  map?: MeshToonNodeMaterial["map"];
  fog?: boolean;
}

export function makeToon(opts: ToonOpts = {}): MeshToonNodeMaterial {
  const material = new MeshToonNodeMaterial({
    gradientMap: toonRampTexture(),
    color: opts.color ?? 0xffffff,
    map: opts.map ?? null,
    fog: opts.fog ?? true,
  });
  return material;
}
