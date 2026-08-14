import {
  BLANK_POIS,
  BLANK_X0,
  BLANK_X1,
  BLANK_Z0,
  BLANK_Z1,
  FLOOR_SIZE,
  GRASS,
  NPC,
  SHRINE,
  SLICE_RESERVE,
  START,
  SWAMP,
  Terrain,
  WATER,
} from "@shapeland/sim";
import { type TerrainStamp, applyBlankStamp, generateBlank, stampToJson } from "@shapeland/tools";

const CELL = 28;
/** One band per unit so height stays countable, the same read the in-game side texture gives. */
const HEIGHT_FILL = [
  "#e8e6e1",
  "#d5d0c8",
  "#c2bcb2",
  "#afa89c",
  "#9c9486",
  "#898071",
  "#766c5b",
  "#635846",
  "#504431",
];
const SPECIALS: Array<readonly [number, number, string]> = [
  [START.x, START.z, "S"],
  [SHRINE.x, SHRINE.z, "F"],
  [NPC.x, NPC.z, "K"],
];

const canvas = document.getElementById("map") as HTMLCanvasElement;
const seedInput = document.getElementById("seed") as HTMLInputElement;
const stats = document.getElementById("stats") as HTMLParagraphElement;

const MIN_ZOOM = 0.05;
const camera = { x: 0, z: -2, zoom: 1 };
let stamp: TerrainStamp = generateBlank(1);
let terrain = bake(stamp);
let dragging = false;
let lastX = 0;
let lastY = 0;

function bake(next: TerrainStamp): Terrain {
  const t = new Terrain();
  for (let x = -7; x <= 7; x++) t.setGap(x, -12);
  applyBlankStamp(t, next);
  return t;
}

function colorFor(x: number, z: number): string {
  if (terrain.isGap(x, z)) return "#1c1c24";
  if (terrain.isWater(x, z)) return WATER;
  if (terrain.isSwamp(x, z)) return SWAMP;
  if (terrain.isGrass(x, z)) return GRASS;
  const h = terrain.height(x, z);
  return HEIGHT_FILL[h] ?? HEIGHT_FILL[HEIGHT_FILL.length - 1] ?? "#504431";
}

function draw(): void {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = "#111114";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const size = CELL * camera.zoom;
  const ox = canvas.width / 2 - camera.x * size;
  const oz = canvas.height / 2 - camera.z * size;
  const col0 = Math.floor(-ox / size) - 1;
  const row0 = Math.floor(-oz / size) - 1;
  const col1 = col0 + Math.ceil(canvas.width / size) + 2;
  const row1 = row0 + Math.ceil(canvas.height / size) + 2;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(8, Math.floor(size * 0.4))}px ui-monospace, monospace`;
  for (let z = row0; z <= row1; z++) {
    for (let x = col0; x <= col1; x++) {
      const sx = ox + x * size;
      const sy = oz + z * size;
      if (x < BLANK_X0 || x > BLANK_X1 || z < BLANK_Z0 || z > BLANK_Z1) {
        ctx.fillStyle = "#0c0c10";
        ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
        continue;
      }
      ctx.fillStyle = colorFor(x, z);
      ctx.fillRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
      if (size > 10) {
        ctx.strokeStyle = "rgba(0,0,0,0.18)";
        ctx.strokeRect(Math.floor(sx), Math.floor(sy), Math.ceil(size), Math.ceil(size));
        if (!terrain.isGap(x, z)) {
          const h = terrain.height(x, z);
          // Surface kind is independent of height, so a wet cell still shows its height.
          const wet = terrain.isWater(x, z) || terrain.isSwamp(x, z) || terrain.isGrass(x, z);
          if (h > 0) {
            ctx.fillStyle = wet ? "rgba(240,240,244,0.85)" : "rgba(20,20,24,0.7)";
            ctx.fillText(String(h), sx + size / 2, sy + size / 2);
          }
        }
      }
    }
  }
  if (size > 8) {
    for (const [x, z, label] of SPECIALS) {
      const sx = ox + x * size;
      const sy = oz + z * size;
      ctx.strokeStyle = "#c9a55e";
      ctx.lineWidth = 2;
      ctx.strokeRect(
        Math.floor(sx) + 1,
        Math.floor(sy) + 1,
        Math.ceil(size) - 2,
        Math.ceil(size) - 2,
      );
      ctx.fillStyle = "#c9a55e";
      ctx.fillText(label, sx + size / 2, sy + size / 2);
    }
  }
  ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeStyle = "rgba(180, 196, 220, 0.55)";
  ctx.strokeRect(
    ox + BLANK_X0 * size,
    oz + BLANK_Z0 * size,
    (BLANK_X1 - BLANK_X0 + 1) * size,
    (BLANK_Z1 - BLANK_Z0 + 1) * size,
  );
  ctx.strokeStyle = "rgba(201, 165, 94, 0.7)";
  ctx.strokeRect(
    ox + SLICE_RESERVE.x0 * size,
    oz + SLICE_RESERVE.z0 * size,
    (SLICE_RESERVE.x1 - SLICE_RESERVE.x0 + 1) * size,
    (SLICE_RESERVE.z1 - SLICE_RESERVE.z0 + 1) * size,
  );

  // Location titles are the navigation system, so the authoring view shows the same names.
  ctx.font = "600 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  for (const poi of BLANK_POIS) {
    const sx = ox + (poi.x + 0.5) * size;
    const sy = oz + (poi.z + 0.5) * size;
    if (sx < -80 || sx > canvas.width + 80 || sy < -40 || sy > canvas.height + 40) continue;
    const r = Math.max(3, size * 0.5);
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "#f0e0b0";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "rgba(12,12,16,0.72)";
    const w = ctx.measureText(poi.name).width + 10;
    ctx.fillRect(sx - w / 2, sy - r - 18, w, 15);
    ctx.fillStyle = "#f0e0b0";
    ctx.fillText(poi.name, sx, sy - r - 10);
  }
}

function fitView(): void {
  camera.x = (BLANK_X0 + BLANK_X1) * 0.5;
  camera.z = (BLANK_Z0 + BLANK_Z1) * 0.5;
  const fit = Math.min(canvas.width, canvas.height) / (CELL * FLOOR_SIZE);
  camera.zoom = Math.min(3, Math.max(MIN_ZOOM, fit * 0.92));
}

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  draw();
}

function load(seed: number): void {
  stamp = generateBlank(seed >>> 0);
  terrain = bake(stamp);
  seedInput.value = String(stamp.seed);
  stats.textContent = `${FLOOR_SIZE} × ${FLOOR_SIZE} · ${stamp.benches.length} benches · ${stamp.pools.length} pools · ${stamp.hills.length} hills · ${stamp.gaps.length} gaps · ${stamp.water.length} water · ${stamp.swamp.length} swamp · ${stamp.grass.length} grass · seed ${stamp.seed}`;
  draw();
}

window.addEventListener("resize", resize);
canvas.addEventListener("mousedown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener("mouseup", () => {
  dragging = false;
});
canvas.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const size = CELL * camera.zoom;
  camera.x -= (e.clientX - lastX) / size;
  camera.z -= (e.clientY - lastY) / size;
  lastX = e.clientX;
  lastY = e.clientY;
  draw();
});
canvas.addEventListener(
  "wheel",
  (e) => {
    e.preventDefault();
    const old = camera.zoom;
    const next = Math.min(3, Math.max(MIN_ZOOM, old * (e.deltaY > 0 ? 0.9 : 1.1)));
    if (next === old) return;
    const size = CELL * old;
    const mx = e.clientX - canvas.width / 2;
    const mz = e.clientY - canvas.height / 2;
    camera.x += mx / size - mx / (CELL * next);
    camera.z += mz / size - mz / (CELL * next);
    camera.zoom = next;
    draw();
  },
  { passive: false },
);

document.getElementById("regen")?.addEventListener("click", () => {
  const typed = (Number(seedInput.value) | 0) >>> 0;
  load(typed === stamp.seed ? (stamp.seed + 1) >>> 0 : typed);
});
document.getElementById("reset")?.addEventListener("click", () => {
  fitView();
  draw();
});
document.getElementById("json")?.addEventListener("click", () => {
  const blob = new Blob([stampToJson(stamp)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `blank-terrain-seed-${stamp.seed}.json`;
  a.click();
  URL.revokeObjectURL(url);
});
seedInput.addEventListener("change", () => load(Number(seedInput.value) | 0));
seedInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") load(Number(seedInput.value) | 0);
});

resize();
load(1);
fitView();
draw();
