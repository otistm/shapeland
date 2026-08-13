import { MODE_ROLL, ROLL_TICKS, createSnapshot } from "@shapeland/sim";
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
  });
});
