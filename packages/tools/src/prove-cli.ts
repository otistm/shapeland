import { runProofs } from "./prove";

const failed = runProofs();
if (failed) process.exit(1);
