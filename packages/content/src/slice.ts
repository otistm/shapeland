export const SLICE_CONTENT = {
  version: 1,
  id: "slice-v1",
} as const;

export const REGION_NAME = ["THE BLANK", "THE GAUNTLET", "THE SEALED CHAMBER"] as const;

export const BANNER_TEXT = [
  "",
  "THE GLYPH SEALS ITSELF TO YOUR UNDERSIDE",
  "THE BLANK REMEMBERS",
  "A SECOND GLYPH ANSWERS",
  "THE SHAPE CRACKS",
  "THE APPROACH IS CLEAR",
  "ICE SEALS ITSELF TO YOUR UNDERSIDE",
] as const;

export const STAGE_HINT = [
  "",
  "ROLL TWICE THE SAME WAY — OR PIVOT — TO RAISE WHAT IS UNDER YOU",
  "A SEAL WAITS FOR FIRE PRESSED INTO IT — PIVOT TO CHOOSE YOUR UNDERSIDE",
  "THE WAY IS OPEN",
  "TWO GLYPHS FOUND · THE BLANK GOES ON",
] as const;

export const AIM_HINT = "THEY READ THE SQUARES BEFORE THEY FIRE";

export const DIALOG_CUE_TOUCH = "TAP TO CONTINUE";
export const DIALOG_CUE_PAD = "A TO CONTINUE";
export const PAD_CONNECTED = "CONTROLLER CONNECTED";
export const PAD_DISCONNECTED = "CONTROLLER DISCONNECTED";

export const NPC_NAME = "THE KEEPER";

export const NPC_LINES: ReadonlyArray<ReadonlyArray<string>> = [
  [
    "A roller. It has been long since one came through.",
    "This is the Blank. It keeps nothing and remembers nothing. Yet.",
    "North of here a glyph still burns. Press yourself upon it, and begin.",
  ],
  [
    "What you carry beneath matters more than what you show.",
    "The seal past the gauntlet drinks only what is pressed into it, face to stone.",
    "If the ground will not turn you the way you need — turn yourself. Pivot.",
  ],
  [
    "What you carry beneath matters more than what you show.",
    "The seal past the gauntlet drinks only what is pressed into it, face to stone.",
    "If the ground will not turn you the way you need — turn yourself. Pivot.",
  ],
  ["The door drank your fire, and gave back colour.", "So the Blank remembers after all."],
  ["Two glyphs now. The Blank goes on, and so must you."],
];
