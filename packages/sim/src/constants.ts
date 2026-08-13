/** Canonical constants. Import these; never restate them locally. */

export const TICK_HZ = 120;
/** Render interpolation only. Sim logic uses the integer `tick`. */
export const DT = 1 / TICK_HZ;
export const MAX_FRAME = 0.25;
export const MAX_STEPS = 8;

export const ROLL_DUR = 0.19;
export const JUMP_V0 = 7.6;
export const GRAV = 25;
export const HANG = 2.3;
export const HANG_AT = 0.62;
export const FLIGHT_DUR = 0.72;
export const LEAP_CELLS = 2;
export const JUMP_BUFFER = 0.2;
export const TUCK_DUR = 0.34;

export const CAM_OFFSET = [0, 8, 15.45] as const;
export const CAM_FOV = 42;
export const CAM_AIM = 0.55;
export const CAM_FOLLOW = 5.2;
export const CAM_CLIMB = 4.5;
export const CAM_LOOKAHEAD = 0.85;
export const CAM_LOOKAHEAD_RATE = 4;
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
export const NORMAL = "#c2beb8";
export const GLYPH_HALO = "rgba(238,244,252,0.95)";
export const GRID_MAJOR = "rgba(132,148,196,0.78)";
export const GRID_MINOR = "rgba(146,161,205,0.48)";
export const GRID_PERIOD = 4;
export const FLOOR_SIZE = 320;
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

export const BUTTON_E = 1 << 0;
export const BUTTON_W = 1 << 1;
export const BUTTON_N = 1 << 2;
export const BUTTON_S = 1 << 3;
export const BUTTON_JUMP = 1 << 4;
export const BUTTON_PIVOT = 1 << 5;
