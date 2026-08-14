/** Canonical constants. Import these; never restate them locally. */

export const TICK_HZ = 120;
/** Render interpolation only. Sim logic uses the integer `tick`. */
export const DT = 1 / TICK_HZ;
export const MAX_FRAME = 0.25;
export const MAX_STEPS = 8;

export const ROLL_DUR = 0.19;
export const CROUCH_DUR = 0.14;
export const JUMP_V0 = 7.6;
export const GRAV = 25;
export const HANG = 2.3;
export const HANG_AT = 0.62;
export const FLIGHT_DUR = 0.72;
export const LEAP_CELLS = 2;
export const JUMP_BUFFER = 0.2;
export const TUCK_DUR = 0.34;
export const TUCK_LIFT = 0.3;
export const ROLL_LIFT = 0.21;
export const ROLL_LIFT_STEP = 0.24;
export const SQUASH_STIFF = 300;
export const SQUASH_DAMP = 21;
export const FALL_GRAV_MUL = 1.4;
export const FALL_KILL_Y = -3.5;
export const CLIFF_DELTA = 2;

/** Pulled back ~15% from (0, 8, 15.45) so height-8 forms stay in frame. Pitch held at ~27.4°. */
export const CAM_OFFSET = [0, 9.2, 17.77] as const;
export const CAM_FOV = 42;
export const CAM_AIM = 0.55;
export const CAM_FOLLOW = 5.2;
export const CAM_CLIMB = 4.5;
export const CAM_LOOKAHEAD = 0.85;
export const CAM_LOOKAHEAD_RATE = 4;
export const CAM_SHAKE_DECAY = 7.5;
export const CAM_KICK_STIFF = 90;
export const CAM_KICK_DAMP = 12;
export const CAM_KICK_PHYS = 2.8;
export const SHAKE_MIN = 0.05;
export const FOG_NEAR = 42;
export const FOG_FAR = 110;

export const AOE_R = 1.55;
export const KILL_PAD = 0.8;
export const TURRET_AIM = 1.5;
export const TURRET_COOL = 1.6;
export const TURRET_RANGE = 6.5;
export const I_FRAMES = 1.0;
export const INTEGRITY = 3;

export const TOON_BANDS = [0.62, 0.84, 1.0] as const;
export const SHAKE_FLOOR = 0.004;
export const PAD_DEAD = 0.38;
export const TOUCH_DEAD = 0.36;
export const STICK_R = 40;

export const CUBE_BODY = "#4a7fd4";
export const FIRE = "#ff5a1f";
export const LIGHTNING = "#3b46e0";
export const PHYSICAL = "#3a3a44";
export const ICE = "#1aa7c4";
/** Wet sheet. Distinct from ice cyan; saturation on white, not a height-band tint. */
export const WATER = "#2e5461";
/** Mud sheet. Olive-grey; slower rolls teach the footing. */
export const SWAMP = "#4a5244";
/** Meadow sheet. Sage; faster rolls teach the spring. */
export const GRASS = "#5e7044";
export const NORMAL = "#c2beb8";
export const GLYPH_HALO = "rgba(238,244,252,0.95)";
export const GRID_MAJOR = "rgba(132,148,196,0.78)";
export const GRID_MINOR = "rgba(146,161,205,0.48)";
export const GRID_PERIOD = 4;
export const FLOOR_SIZE = 320;
/** Inclusive cell range of the Blank bake. One cell per floor unit: 320 × 320 = 102_400 squares. */
export const BLANK_X0 = -(FLOOR_SIZE >> 1);
export const BLANK_X1 = (FLOOR_SIZE >> 1) - 1;
export const BLANK_Z0 = BLANK_X0;
export const BLANK_Z1 = BLANK_X1;
export const SHADOW_EXTENT = 22;
export const SHADOW_FAR = 70;
export const SHADOW_RADIUS = 1.8;
export const SHADOW_BIAS = -0.0012;
export const KEY_LIGHT = [-8, 10.5, 1] as const;
export const HEMI_SKY = 0xffffff;
export const HEMI_GROUND = 0xe9e7f2;
export const HEMI_INTENSITY = 0.8;
export const SUN_COLOR = 0xfffdf6;
export const SUN_INTENSITY = 0.7;
export const FOG_COLOR = 0xffffff;

export const JUMP_BUFFER_TICKS = 24;
export const ROLL_TICKS = 23;
/** ~1.52× a dry roll. Sticky footing costs tempo; not a second quarter-turn. */
export const SWAMP_ROLL_TICKS = 35;
/** ~0.78× a dry roll. Springy footing returns tempo; not a second quarter-turn. */
export const GRASS_ROLL_TICKS = 18;
export const CROUCH_TICKS = 17;
export const TUCK_TICKS = 41;
/** 120Hz hang-zone integrator; ~0.717s, matching FLIGHT_DUR ≈ 0.72. */
export const FLIGHT_TICKS = 86;

export const BUTTON_E = 1 << 0;
export const BUTTON_W = 1 << 1;
export const BUTTON_N = 1 << 2;
export const BUTTON_S = 1 << 3;
export const BUTTON_JUMP = 1 << 4;
export const BUTTON_PIVOT = 1 << 5;
export const BUTTON_DIR = BUTTON_E | BUTTON_W | BUTTON_N | BUTTON_S;
export const BUTTON_ACT = BUTTON_JUMP | BUTTON_PIVOT;

export const DIR_NONE = 0;
export const DIR_E = 1;
export const DIR_W = 2;
export const DIR_N = 3;
export const DIR_S = 4;
export const DIR_DX = [0, 1, -1, 0, 0] as const;
export const DIR_DZ = [0, 0, 0, -1, 1] as const;

export const MODE_IDLE = 0;
export const MODE_ROLL = 1;
export const MODE_TUCK = 2;
export const MODE_CROUCH = 3;
export const MODE_AIR = 4;
export const MODE_FALL = 5;
export const MODE_SLIDE = 6;

export const FLAG_REFUSE = 1 << 0;
export const FLAG_LAND = 1 << 1;
export const FLAG_LAND_DOWN = 1 << 2;
export const FLAG_LAUNCH = 1 << 3;
export const FLAG_PIVOT = 1 << 4;
/** Jump/leap landing only. Ability VFX arms from the up face on this flag. */
export const FLAG_AIR_LAND = 1 << 5;

export const FIRE_MAX = 340;
export const FIRE_BUOY = 10;
export const FIRE_TAU = 0.36;
export const FIRE_DRAG = 1.2;
export const FIRE_ENTRAIN = 0.16;
export const FIRE_NECK_AMT = 0.45;
export const FIRE_NECK_H = 0.22;
export const FIRE_NECK_W = 0.16;
export const FIRE_RAD_K = 6;
export const FIRE_SWIRL0 = 2.2;
export const FIRE_SWIRL_TAU = 0.5;
export const FIRE_V0 = 0.6;
export const FIRE_R0 = 0.3;
export const FIRE_MAX_AGE = 1.35;
export const FIRE_BASE_RATE = 64;
export const FIRE_PUFF_N = 18;
/** Puff Hz at D = 1: 1.5 / √D. Authored so sim never calls sqrt for the default source. */
export const FIRE_PUFF_HZ = 1.5;
export const FIRE_STRETCH_K = 0.22;
export const FIRE_STRETCH_CAP = 1.15;

/** 3.4s at 120Hz. Re-ignite extends remaining duration up to the cap. */
export const BURN_BASE_TICKS = 408;
export const BURN_CAP_TICKS = 780;
export const BURN_IN_TICKS = 17;
export const BURN_OUT = 0.3;

export const BOLT_TOP = 11;
export const BOLT_LEVELS = 5;
export const BOLT_DISP = 1.9;
export const BOLT_POINTS = 33;
export const BOLT_BRANCH_LEVELS = 4;
export const BOLT_BRANCH_POINTS = 17;
export const BOLT_MAX_BRANCHES = 5;
export const BOLT_MIN_BRANCHES = 3;
export const SPREAD_R = 2.6;
export const SPREAD_DUR = 0.45;

export const SCORCH_MAX = 256;
export const ICE_MAX = 256;
export const SLIDE_MAX = 8;
export const SLIDE_CELL_TICKS = 10;

export const VFX_PULSE_NONE = 0;
export const VFX_PULSE_FIRE = 1;
export const VFX_PULSE_BOLT = 2;
export const VFX_PULSE_PHYS = 3;
export const VFX_PULSE_ICE = 4;

export const SHAKE_FIRE = 0.06;
export const SHAKE_BOLT = 0.13;
export const SHAKE_PHYS = 0.2;
export const SHAKE_HURT = 0.18;
export const SHAKE_DOOR = 0.15;
export const SHAKE_SENTRY = 0.14;
export const SHAKE_BLAST = 0.05;
export const SHAKE_ICE = 0.05;

export const TELE_COLOR = 0xb8412a;

export const TURRET_COUNT = 5;
export const TURRET_AIM_TICKS = 180;
export const TURRET_COOL_TICKS = 192;
export const I_FRAMES_TICKS = 120;
export const RESPAWN_IFRAMES = 144;
/** Integer d² cutoff for AOE_R + KILL_PAD (2.35² ≈ 5.52 → 5). */
export const KILL_RANGE2 = 5;
/** Integer d² cutoff for TURRET_RANGE 6.5 (42.25 → 42). */
export const TURRET_RANGE2 = 42;

export const TURRET_IDLE = 0;
export const TURRET_STATE_AIM = 1;
export const TURRET_STATE_COOL = 2;

export const STAGE_SEEK = 0;
export const STAGE_RAISE = 1;
export const STAGE_TRAVEL = 2;
export const STAGE_INSIDE = 3;
export const STAGE_DONE = 4;

export const REGION_BLANK = 0;
export const REGION_GAUNTLET = 1;
export const REGION_CHAMBER = 2;

export const BANNER_NONE = 0;
export const BANNER_SHRINE = 1;
export const BANNER_DOOR = 2;
export const BANNER_GLYPH = 3;
export const BANNER_CRACK = 4;
export const BANNER_CLEAR = 5;
export const BANNER_ICE = 6;
export const BANNER_ZIG = 7;

export const FLAG_HURT = 1 << 6;
export const FLAG_KILL = 1 << 7;
export const FLAG_DOOR = 1 << 8;
export const FLAG_BLAST = 1 << 9;
export const FLAG_FALL_KILL = 1 << 10;

export const SKY_TOP = 1.0;
export const SKY_SIDE = 0.78;
export const SKY_CREV = 0.86;
export const SKY_STACK = 0.055;
/**
 * Tallest authored terrain form. 8 is not arbitrary: it is in the preferred dimension set
 * (1,2,3,5,8,13,21,34,55), it is exactly one legal stair flight (8–13 risers before a landing is
 * required), and it is the "minor marker, readable at 40 cells" landmark tier. A 1:1 apron from 8
 * costs 8 cells of run on every side, which is why tall forms are broad — that is the honest price
 * of "a slope is a staircase". See ADR 0015.
 */
export const TERRAIN_PEAK_MAX = 8;
/** Noise-scattered filler stays under the named landmarks so the skyline reads as authored. */
export const TERRAIN_FILLER_PEAK_MAX = 5;
/**
 * Tallest structure mass. 21 is a regional monolith (readable at ~100 cells). It is occupancy, not
 * a walkable height — a 21u pier does not grow a 21-cell apron. See ADR 0017.
 */
export const STRUCTURE_PEAK_MAX = 21;
/** Superstructure on a landform plinth, still in the preferred set. */
export const STRUCTURE_MARK = 13;
