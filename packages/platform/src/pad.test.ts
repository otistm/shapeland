import { BUTTON_E, BUTTON_JUMP, BUTTON_N, BUTTON_PIVOT } from "@shapeland/sim";
import { describe, expect, it } from "vitest";
import {
  PAD_EQUIP,
  PAD_HAT_UP,
  PAD_POLICY_MSG,
  createPadPoller,
  risingGroup,
  routePad,
} from "./pad";

function btn(pressed: boolean): GamepadButton {
  return { pressed, touched: pressed, value: pressed ? 1 : 0 };
}

function fakePad(opts: {
  buttons?: Record<number, boolean>;
  axes?: number[];
  id?: string;
  connected?: boolean;
}): Gamepad {
  const buttons: GamepadButton[] = [];
  for (let i = 0; i < 17; i++) buttons.push(btn(!!opts.buttons?.[i]));
  return {
    id: opts.id ?? "test-pad",
    index: 0,
    connected: opts.connected !== false,
    mapping: "standard",
    timestamp: 0,
    axes: opts.axes ?? [0, 0, 0, 0],
    buttons,
    vibrationActuator: null,
  } as Gamepad;
}

describe("qa-pad rising group", () => {
  it("visits every index so a held later button cannot misfire next poll", () => {
    const now = [false, false, false, false, false, false, false, false, true, true];
    const first = risingGroup((i) => !!now[i], PAD_EQUIP, 0);
    expect(first.any).toBe(true);
    const second = risingGroup((i) => !!now[i], PAD_EQUIP, first.nextBits);
    expect(second.any).toBe(false);
    now[9] = false;
    const third = risingGroup((i) => !!now[i], PAD_EQUIP, second.nextBits);
    expect(third.any).toBe(false);
  });
});

describe("qa-pad poller", () => {
  it("lets the hat beat a deflected stick", () => {
    const pad = fakePad({
      buttons: { [PAD_HAT_UP]: true },
      axes: [1, 0, 0, 0],
    });
    const poller = createPadPoller({ getGamepads: () => [pad] });
    expect(poller.poll().mask).toBe(BUTTON_N);
  });

  it("axis-locks the stick at 0.38 and pulses A/B on the rising edge", () => {
    const pad = fakePad({ axes: [0.9, -0.4, 0, 0] });
    const poller = createPadPoller({ getGamepads: () => [pad] });
    expect(poller.poll().mask).toBe(BUTTON_E);

    pad.axes[0] = 0.2;
    pad.axes[1] = -0.9;
    expect(poller.poll().mask).toBe(BUTTON_N);

    pad.axes[0] = 0.37;
    pad.axes[1] = 0;
    expect(poller.poll().mask).toBe(0);

    pad.buttons[0] = btn(true);
    const jump = poller.poll();
    expect(jump.risingJump).toBe(true);
    expect(jump.risingSpeak).toBe(false);
    expect(jump.mask & BUTTON_JUMP).toBe(BUTTON_JUMP);

    const held = poller.poll();
    expect(held.risingJump).toBe(false);
    expect(held.mask & BUTTON_JUMP).toBe(0);

    pad.buttons[1] = btn(true);
    const pivot = poller.poll();
    expect(pivot.risingPivot).toBe(true);
    expect(pivot.mask & BUTTON_PIVOT).toBe(BUTTON_PIVOT);
  });

  it("maps Y to speak and Start/Select to equip, never A to speak", () => {
    const pad = fakePad({ buttons: { 0: true, 3: true, 9: true } });
    const poller = createPadPoller({ getGamepads: () => [pad] });
    const frame = poller.poll();
    expect(frame.risingJump).toBe(true);
    expect(frame.risingSpeak).toBe(true);
    expect(frame.risingEquip).toBe(true);
    expect(frame.mask & BUTTON_JUMP).toBe(BUTTON_JUMP);

    pad.buttons[9] = btn(false);
    pad.buttons[8] = btn(true);
    const select = poller.poll();
    expect(select.risingEquip).toBe(true);
    expect(select.risingJump).toBe(false);
    expect(select.risingSpeak).toBe(false);
  });

  it("disables permanently after one policy throw and logs once", () => {
    const logs: string[] = [];
    let calls = 0;
    const poller = createPadPoller({
      getGamepads: () => {
        calls += 1;
        throw new Error("SecurityError");
      },
      log: (msg) => logs.push(msg),
    });
    expect(poller.poll().connected).toBe(false);
    expect(poller.poll().connected).toBe(false);
    expect(poller.poll().connected).toBe(false);
    expect(calls).toBe(1);
    expect(poller.blocked).toBe(true);
    expect(logs).toEqual([PAD_POLICY_MSG]);
  });

  it("captures the mask while a modal is open and does not let A speak", () => {
    const pad = fakePad({ buttons: { 0: true }, axes: [1, 0, 0, 0] });
    const poller = createPadPoller({ getGamepads: () => [pad] });
    const jump = poller.poll();
    expect(routePad(jump, true, false)).toEqual({ route: "confirm", mask: 0 });
    expect(routePad(jump, false, false).mask & BUTTON_JUMP).toBe(BUTTON_JUMP);
    expect(routePad(jump, false, false).route).toBe("move");

    pad.buttons[0] = btn(false);
    pad.buttons[3] = btn(true);
    const speak = poller.poll();
    expect(routePad(speak, false, false).route).toBe("speak");
    expect(routePad(speak, true, false).route).toBe("confirm");
  });

  it("clears direction when the pad disconnects", () => {
    const pad = fakePad({ axes: [1, 0, 0, 0] });
    let list: (Gamepad | null)[] = [pad];
    const poller = createPadPoller({ getGamepads: () => list });
    expect(poller.poll().connected).toBe(true);
    expect(poller.poll().mask).toBe(BUTTON_E);
    list = [];
    const gone = poller.poll();
    expect(gone.connected).toBe(false);
    expect(gone.mask).toBe(0);
  });
});
