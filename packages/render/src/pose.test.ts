import { MODE_ROLL, MODE_SLIDE, ROLL_TICKS, createSnapshot } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import { cameraTarget, rollEase, visualPose } from "./pose";

describe("camera feed vs body ease", () => {
  it("follows linear roll progress, never the eased cube x", () => {
    const s = createSnapshot();
    s.move.mode = MODE_ROLL;
    s.move.dir = 1;
    s.move.phase = 11;
    s.move.duration = ROLL_TICKS;
    s.move.startX = 0;
    s.move.destX = 1;
    s.move.startOri = 0;
    s.move.destOri = 12;
    const t = 11 / ROLL_TICKS;
    const cam = cameraTarget(s);
    const pose = visualPose(s);
    expect(cam.followX).toBeCloseTo(t, 10);
    expect(pose.x).toBeCloseTo(rollEase(t), 10);
    expect(cam.followX).not.toBeCloseTo(pose.x, 3);
    expect(cam.restY).toBe(0);
    expect(cam.aimX).toBe(1);
    expect(cam.aimZ).toBe(0);
  });

  it("feeds resting destination height, never the roll lift", () => {
    const s = createSnapshot();
    s.move.mode = MODE_ROLL;
    s.move.dir = 1;
    s.move.phase = 11;
    s.move.duration = ROLL_TICKS;
    s.move.startY = 0;
    s.move.destY = 2;
    const cam = cameraTarget(s);
    const pose = visualPose(s);
    expect(cam.restY).toBe(2);
    expect(pose.y).not.toBeCloseTo(2.5, 2);
  });

  it("slides with linear translation and no extra spin", () => {
    const s = createSnapshot();
    s.move.mode = MODE_SLIDE;
    s.move.dir = 1;
    s.move.phase = 5;
    s.move.duration = 10;
    s.move.startX = 1;
    s.move.destX = 3;
    s.move.startOri = 0;
    s.move.destOri = 0;
    const cam = cameraTarget(s);
    const pose = visualPose(s);
    expect(cam.followX).toBeCloseTo(2, 10);
    expect(pose.x).toBeCloseTo(2, 10);
    expect(cam.followX).toBeCloseTo(pose.x, 10);
    expect(cam.aimX).toBe(1);
    expect(pose.quat.x).toBeCloseTo(0, 6);
    expect(pose.quat.y).toBeCloseTo(0, 6);
    expect(pose.quat.z).toBeCloseTo(0, 6);
    expect(pose.quat.w).toBeCloseTo(1, 6);
  });
});
