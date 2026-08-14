import { writeFileSync } from "node:fs";
import { generateBlank, stampToJson, stampToTs } from "./terrain-gen";

const seedArg = process.argv.find((a) => a.startsWith("--seed="));
const seed = seedArg ? Number(seedArg.slice("--seed=".length)) | 0 : 1;
const outArg = process.argv.find((a) => a.startsWith("--out="));
const asTs = process.argv.includes("--ts");
const stamp = generateBlank(seed);
const text = asTs ? stampToTs(stamp) : stampToJson(stamp);
if (outArg) writeFileSync(outArg.slice("--out=".length), text);
else process.stdout.write(text);
