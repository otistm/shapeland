import { POI_CEILING, planPois } from "./blank-plan";
import { auditTerrain } from "./terrain-audit";
import { generateBlank, validatePlan } from "./terrain-gen";

const seedArg = process.argv.find((a) => a.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.slice("--seed=".length)) | 0 : 1;

const problems = validatePlan();
if (problems.length) {
  process.stdout.write(`plan invalid:\n  ${problems.join("\n  ")}\n`);
  process.exitCode = 1;
} else {
  const stamp = generateBlank(seed);
  const a = auditTerrain(stamp);
  const bands = [...a.perHeight.entries()].sort((x, y) => x[0] - y[0]);
  const lines: string[] = [
    `seed ${stamp.seed}`,
    `forms      ${stamp.benches.length} benches · ${stamp.pools.length} pools · ${stamp.hills.length} hills`,
    `surfaces   ${stamp.gaps.length} gaps · ${stamp.water.length} water · ${stamp.swamp.length} swamp · ${stamp.grass.length} grass`,
    `raised     ${a.raised} cells, tallest ${a.maxHeight}`,
    `bands      ${bands.map(([h, n]) => `h${h}:${n}`).join(" ")}`,
    `reachable  ${a.reachable} cells roll-reachable from start`,
    `stranded   ${a.strandedCells} raised cells without a ±1 stair neighbour`,
    `orphans    benches ${a.unreachableBenchTops} · hills ${a.unreachableHills} · water ${a.unreachableWater} · grass ${a.unreachableGrass}`,
    a.unreachablePois.length
      ? `POI        UNREACHABLE: ${a.unreachablePois.join(", ")}`
      : `POI        all ${planPois().length} named places roll-reachable`,
  ];
  for (const g of a.poiGaps) {
    const flag = g.cells > POI_CEILING ? "  OVER CEILING" : "";
    lines.push(`  ${String(g.cells).padStart(4)} cells  ${g.from} -> ${g.to}${flag}`);
  }
  process.stdout.write(`${lines.join("\n")}\n`);
}
