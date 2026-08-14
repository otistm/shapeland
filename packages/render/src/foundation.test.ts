import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CAM_AIM, CAM_CLIMB, CAM_FOV, CAM_OFFSET, CUBE_BODY, TOON_BANDS, UP } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import {
  cameraOffsetForYaw,
  cameraOffsetLength,
  cameraPitchDeg,
  cameraYawDeg,
  createCameraRig,
  impactShake,
  lookAtY,
  occlusionLift,
  stepCamera,
  turnCameraYaw,
  unwrapQuarter,
} from "./camera";
import { proveCamera } from "./camera-proof";
import { SIM_FACE_FOR_GROUP, orientationQuaternion, upGroup } from "./orientation-map";
import { contrastRatio, hexToRgb, scaledHex } from "./palette";
import { sampleToonRamp, toonRampBytes } from "./toon-ramp";

describe("qa-cam", () => {
  it("matches the canonical offset, fov, aim, and yaw 0", () => {
    expect(CAM_OFFSET).toEqual([0, 9.2, 17.77]);
    expect(CAM_FOV).toBe(42);
    expect(CAM_AIM).toBe(0.55);
    expect(cameraYawDeg()).toBeCloseTo(0, 5);
    expect(cameraPitchDeg()).toBeCloseTo(27.4, 1);
    expect(cameraOffsetLength()).toBeCloseTo(20.0, 1);
  });

  it("keeps pitch, distance, and axis-aligned offset at every quarter-turn", () => {
    for (let q = 0; q < 4; q++) {
      const [ox, oy, oz] = cameraOffsetForYaw(q);
      expect(oy).toBe(CAM_OFFSET[1]);
      expect(ox === 0 || oz === 0).toBe(true);
      expect(Math.hypot(ox, oy, oz)).toBeCloseTo(20.0, 1);
    }
    expect(cameraYawDeg(1)).toBeCloseTo(-90, 5);
    expect(Math.abs(cameraYawDeg(2))).toBeCloseTo(180, 5);
    expect(cameraYawDeg(3)).toBeCloseTo(90, 5);
    expect(cameraPitchDeg()).toBeCloseTo(27.4, 1);
  });

  it("unwraps successive taps so a 180° orbit keeps the tapped direction", () => {
    expect(unwrapQuarter(0, 1)).toBe(1);
    expect(unwrapQuarter(0.9, 0)).toBe(0);
    expect(unwrapQuarter(3.2, 0)).toBe(4);
    expect(unwrapQuarter(0.2, 3)).toBe(-1);
  });

  it("orbits a quarter-turn without snapping or writing shake", () => {
    const rig = createCameraRig();
    const ready = { current: false };
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
    turnCameraYaw(rig, 1);
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 / 120 }, ready);
    expect(rig.yaw).toBe(1);
    expect(rig.position.x).toBeGreaterThan(-CAM_OFFSET[2] + 1);
    expect(rig.position.x).toBeLessThan(0);
    expect(rig.shake).toBe(0);
    for (let i = 0; i < 240; i++) {
      stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 / 120 }, ready);
    }
    expect(rig.position.x).toBeCloseTo(-CAM_OFFSET[2], 1);
    expect(rig.position.z).toBeCloseTo(0, 1);
    expect(rig.yawVisual).toBe(1);
  });

  it("snaps the orbit under reduced motion", () => {
    const rig = createCameraRig();
    const ready = { current: false };
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
    turnCameraYaw(rig, 1);
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 / 120, reduced: true }, ready);
    expect(rig.yawVisual).toBe(1);
    expect(rig.position.x).toBeCloseTo(-CAM_OFFSET[2], 1);
    expect(rig.position.z).toBeCloseTo(0, 1);
  });

  it("tracks resting ground height, not the cube's visual y", () => {
    const rig = createCameraRig();
    const ready = { current: false };
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
    const yAtRest = rig.position.y;
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
    expect(rig.position.y).toBeCloseTo(yAtRest, 5);
    expect(lookAtY(rig)).toBeCloseTo(0.55, 5);
    expect(rig.shake).toBe(0);
  });

  it("climbs toward a terrace rest height slower than a roll", () => {
    const rig = createCameraRig();
    const ready = { current: false };
    stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
    const y0 = rig.target.y;
    stepCamera(rig, { followX: 0, followZ: 0, restY: 1, dt: 1 / 120 }, ready);
    expect(rig.target.y).toBeGreaterThan(y0);
    expect(rig.target.y).toBeLessThan(1);
    expect(CAM_CLIMB).toBe(4.5);
    for (let i = 0; i < 200; i++) {
      stepCamera(rig, { followX: 0, followZ: 0, restY: 1, dt: 1 / 120 }, ready);
    }
    expect(rig.target.y).toBeCloseTo(1, 2);
  });

  it("does not shake on traversal", () => {
    const rig = createCameraRig();
    const ready = { current: false };
    for (let x = 0; x < 8; x++) {
      stepCamera(rig, { followX: x, followZ: 0, restY: 0, dt: 0.2 }, ready);
    }
    expect(rig.shake).toBe(0);
    impactShake(rig, 0.04);
    expect(rig.shake).toBe(0);
    impactShake(rig, 0.12);
    expect(rig.shake).toBe(0.12);
  });

  it("proves shake policy, zero bob, and linear-vs-eased ripple", () => {
    const failed = proveCamera()
      .filter((line) => !line.ok)
      .map((line) => line.message);
    expect(failed).toEqual([]);
  });

  it("lifts over a height-8 column on the look vector without writing shake", () => {
    const heightAt = (x: number, z: number) => (x === 0 && z === 8 ? 8 : 0);
    expect(occlusionLift(heightAt, 0, 0, 0)).toBeGreaterThan(2);
    const rig = createCameraRig();
    const ready = { current: false };
    for (let i = 0; i < 240; i++) {
      stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 / 120, heightAt }, ready);
    }
    expect(rig.occludeY).toBeGreaterThan(2);
    expect(rig.shake).toBe(0);
    const flat = createCameraRig();
    const flatReady = { current: false };
    stepCamera(flat, { followX: 0, followZ: 0, restY: 0, dt: 1, heightAt: () => 0 }, flatReady);
    expect(flat.occludeY).toBe(0);
  });

  it("lifts over a height-8 column on the rotated look vector", () => {
    const west = (x: number, z: number) => (x === -8 && z === 0 ? 8 : 0);
    expect(occlusionLift(west, 0, 0, 0, 1)).toBeGreaterThan(2);
    expect(occlusionLift(west, 0, 0, 0, 0)).toBe(0);
    const south = (x: number, z: number) => (x === 0 && z === -8 ? 8 : 0);
    expect(occlusionLift(south, 0, 0, 0, 2)).toBeGreaterThan(2);
  });
});

describe("qa-toon", () => {
  it("is a 3-texel nearest ramp at the canonical values", () => {
    const bytes = toonRampBytes();
    expect(bytes.length).toBe(12);
    expect(TOON_BANDS).toEqual([0.62, 0.84, 1.0]);
    expect(bytes[0]).toBe(Math.round(0.62 * 255));
    expect(bytes[4]).toBe(Math.round(0.84 * 255));
    expect(bytes[8]).toBe(255);
    const golden = JSON.parse(
      readFileSync(
        join(dirname(fileURLToPath(import.meta.url)), "..", "goldens", "toon-ramp.json"),
        "utf8",
      ),
    ) as number[];
    expect([...bytes]).toEqual(golden);
    expect(sampleToonRamp(1)).toBe(1);
    expect(sampleToonRamp(-1)).toBe(0.62);
    expect(sampleToonRamp(0)).toBe(0.84);
  });
});

describe("qa-tint", () => {
  it("keeps cube-on-white contrast in the authored band", () => {
    const white = "#ffffff";
    const lit = contrastRatio(CUBE_BODY, white);
    const shadow = contrastRatio(scaledHex(CUBE_BODY, 0.62), white);
    expect(lit).toBeGreaterThanOrEqual(1.99);
    expect(shadow).toBeGreaterThan(lit);
    const linear = (hex: string) => {
      const [r, g, b] = hexToRgb(hex);
      return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    };
    const linearContrast = (hex: string) => 1.05 / (linear(hex) + 0.05);
    expect(linearContrast(CUBE_BODY)).toBeCloseTo(1.99, 1);
    expect(linearContrast(scaledHex(CUBE_BODY, 0.62))).toBeCloseTo(3.03, 1);
  });
});

describe("orientation remap", () => {
  it("identity is no rotation and sim face 0 is world-up", () => {
    const q = orientationQuaternion(0);
    expect(q.x).toBeCloseTo(0, 6);
    expect(q.y).toBeCloseTo(0, 6);
    expect(q.z).toBeCloseTo(0, 6);
    expect(q.w).toBeCloseTo(1, 6);
    expect(upGroup(0)).toBe(2);
    expect(SIM_FACE_FOR_GROUP[upGroup(0)]).toBe(UP(0));
  });

  it("yaw 90 maps to a game-Y rotation and keeps the up face", () => {
    const q = orientationQuaternion(1);
    expect(Math.abs(q.x)).toBeCloseTo(0, 5);
    expect(Math.abs(q.z)).toBeCloseTo(0, 5);
    expect(Math.abs(q.y)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(Math.abs(q.w)).toBeCloseTo(Math.SQRT1_2, 5);
    expect(SIM_FACE_FOR_GROUP[upGroup(1)]).toBe(UP(1));
  });

  it("every orientation puts the sim up-face on the world-up group", () => {
    for (let i = 0; i < 24; i++) {
      expect(SIM_FACE_FOR_GROUP[upGroup(i)]).toBe(UP(i));
    }
  });
});
