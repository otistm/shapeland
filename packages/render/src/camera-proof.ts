import {
  CAM_KICK_PHYS,
  CAM_LOOKAHEAD,
  CAM_LOOKAHEAD_RATE,
  CAM_OFFSET,
  CAM_YAW_RATE,
  DT,
  MODE_ROLL,
  type ProofLine,
  ROLL_TICKS,
  SHAKE_BLAST,
  SHAKE_BOLT,
  SHAKE_DOOR,
  SHAKE_FIRE,
  SHAKE_FLOOR,
  SHAKE_HURT,
  SHAKE_ICE,
  SHAKE_MIN,
  SHAKE_PHYS,
  SHAKE_SENTRY,
  createSnapshot,
} from "@shapeland/sim";
import { createCameraRig, impactKick, impactShake, stepCamera, turnCameraYaw } from "./camera";
import { cameraTarget, visualPose } from "./pose";

function log(lines: ProofLine[], ok: boolean, message: string): void {
  lines.push({ ok, message });
}

/** RMS deviation of successive sample velocities from their mean. */
export function velocityRipple(samples: number[], dt: number): number {
  if (samples.length < 3 || dt <= 0) return 0;
  const n = samples.length - 1;
  let mean = 0;
  const vel = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const v = ((samples[i + 1] ?? 0) - (samples[i] ?? 0)) / dt;
    vel[i] = v;
    mean += v;
  }
  mean /= n;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = (vel[i] ?? 0) - mean;
    acc += d * d;
  }
  return Math.sqrt(acc / n);
}

function sampleRoll(): { linear: number[]; eased: number[] } {
  const linear: number[] = [];
  const eased: number[] = [];
  const s = createSnapshot();
  s.move.mode = MODE_ROLL;
  s.move.dir = 1;
  s.move.duration = ROLL_TICKS;
  s.move.startX = 0;
  s.move.destX = 1;
  s.move.startOri = 0;
  s.move.destOri = 12;
  for (let phase = 0; phase <= ROLL_TICKS; phase++) {
    s.move.phase = phase;
    linear.push(cameraTarget(s).followX);
    eased.push(visualPose(s).x);
  }
  return { linear, eased };
}

export function proveCamera(): ProofLine[] {
  const lines: ProofLine[] = [];
  const shakes = [
    SHAKE_FIRE,
    SHAKE_BOLT,
    SHAKE_PHYS,
    SHAKE_HURT,
    SHAKE_DOOR,
    SHAKE_SENTRY,
    SHAKE_BLAST,
    SHAKE_ICE,
  ];
  log(
    lines,
    shakes.every((a) => a >= SHAKE_MIN) && SHAKE_MIN === 0.05 && SHAKE_FLOOR === 0.004,
    `impact shakes ≥ ${SHAKE_MIN}, floor ${SHAKE_FLOOR}`,
  );

  const { linear, eased } = sampleRoll();
  const linearR = velocityRipple(linear, DT);
  const easedR = velocityRipple(eased, DT);
  log(lines, linearR < 1e-12, `linear roll feed ripple ${linearR} (want 0)`);
  log(lines, easedR > 0.5, `eased body ripple ${easedR.toFixed(3)} u/s (want > 0.5)`);
  const ratio = easedR / (linearR < 1e-12 ? 1e-12 : linearR);
  log(lines, ratio > 10_000, `ripple ratio ${ratio.toExponential(2)} (want > 10,000×)`);

  const rig = createCameraRig();
  const ready = { current: false };
  stepCamera(rig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, ready);
  const y0 = rig.target.y;
  for (let phase = 0; phase <= ROLL_TICKS; phase++) {
    const t = phase / ROLL_TICKS;
    stepCamera(rig, { followX: t, followZ: 0, restY: 0, dt: DT }, ready);
  }
  log(
    lines,
    rig.target.y === y0 && rig.shake === 0,
    `flat roll camera bob ${rig.target.y - y0} (want 0)`,
  );

  const look = createCameraRig();
  const lookReady = { current: false };
  stepCamera(look, { followX: 0, followZ: 0, restY: 0, aimX: 1, dt: 1 }, lookReady);
  for (let i = 0; i < 240; i++) {
    stepCamera(look, { followX: 0, followZ: 0, restY: 0, aimX: 1, dt: DT }, lookReady);
  }
  log(
    lines,
    Math.abs(look.lookAheadX - CAM_LOOKAHEAD) < 0.02 && Math.abs(look.lookAheadZ) < 1e-9,
    `look-ahead settles to ${look.lookAheadX.toFixed(3)} (want ${CAM_LOOKAHEAD})`,
  );

  const a = createCameraRig();
  const b = createCameraRig();
  const ra = { current: false };
  const rb = { current: false };
  const dt60 = 1 / 60;
  const dt144 = 1 / 144;
  const t = 1;
  for (let i = 0; i < Math.round(t / dt60); i++) {
    stepCamera(a, { followX: 0, followZ: 0, restY: 0, aimX: 1, dt: dt60 }, ra);
  }
  for (let i = 0; i < Math.round(t / dt144); i++) {
    stepCamera(b, { followX: 0, followZ: 0, restY: 0, aimX: 1, dt: dt144 }, rb);
  }
  log(
    lines,
    Math.abs(a.lookAheadX - b.lookAheadX) < 1e-3,
    `look-ahead 60Hz vs 144Hz Δ ${Math.abs(a.lookAheadX - b.lookAheadX)} (exp, not lerp)`,
  );
  log(lines, CAM_LOOKAHEAD_RATE === 4, `look-ahead rate ${CAM_LOOKAHEAD_RATE}`);
  log(lines, CAM_YAW_RATE === 8, `yaw orbit rate ${CAM_YAW_RATE}`);

  const kick = createCameraRig();
  const kr = { current: false };
  stepCamera(kick, { followX: 0, followZ: 0, restY: 0, dt: 1 }, kr);
  impactKick(kick, CAM_KICK_PHYS);
  const yKick = kick.kickY;
  for (let i = 0; i < 8; i++) {
    stepCamera(kick, { followX: 0, followZ: 0, restY: 0, dt: DT }, kr);
  }
  log(lines, kick.kickY < yKick, `kick spring drops then recovers (y ${kick.kickY})`);
  for (let i = 0; i < 400; i++) {
    stepCamera(kick, { followX: 0, followZ: 0, restY: 0, dt: DT }, kr);
  }
  log(lines, Math.abs(kick.kickY) < 0.01 && Math.abs(kick.kickV) < 0.05, "kick settles to 0");

  const sh = createCameraRig();
  impactShake(sh, 0.049);
  log(lines, sh.shake === 0, "sub-0.05 shake is ignored");
  impactShake(sh, 0.12);
  const before = sh.shake;
  stepCamera(sh, { followX: 0, followZ: 0, restY: 0, dt: DT }, { current: true });
  log(lines, sh.shake < before && sh.shake > 0, "shake decays and never grows from traversal");
  for (let i = 0; i < 120; i++) {
    stepCamera(sh, { followX: i, followZ: 0, restY: 0, dt: 0.05 }, { current: true });
  }
  log(lines, sh.shake === 0, "shake hits the 0.004 floor and stops");

  const yawRig = createCameraRig();
  const yawReady = { current: false };
  stepCamera(yawRig, { followX: 0, followZ: 0, restY: 0, dt: 1 }, yawReady);
  turnCameraYaw(yawRig, 1);
  stepCamera(yawRig, { followX: 0, followZ: 0, restY: 0, dt: DT }, yawReady);
  const midX = yawRig.position.x - yawRig.target.x;
  log(
    lines,
    yawRig.yaw === 1 && midX < 0 && midX > -CAM_OFFSET[2] + 0.5 && yawRig.shake === 0,
    `orbit in flight x ${midX.toFixed(2)} (not snapped), no shake`,
  );
  for (let i = 0; i < 240; i++) {
    stepCamera(yawRig, { followX: 0, followZ: 0, restY: 0, dt: DT }, yawReady);
  }
  const ox = yawRig.position.x - yawRig.target.x;
  const oz = yawRig.position.z - yawRig.target.z;
  log(
    lines,
    yawRig.yaw === 1 &&
      Math.abs(ox + CAM_OFFSET[2]) < 0.05 &&
      Math.abs(oz) < 0.05 &&
      yawRig.shake === 0,
    `quarter-turn yaw ${yawRig.yaw} settled (${ox.toFixed(2)}, ${oz.toFixed(2)}) axis-aligned, no shake`,
  );

  return lines;
}
