import { proveCubeGroup, proveMovement } from "@shapeland/sim";

export function runProofs(log: (line: string) => void = console.log): number {
  const lines = [...proveCubeGroup(), ...proveMovement()];
  let failed = 0;
  for (const line of lines) {
    log(`${line.ok ? "ok  " : "FAIL"} ${line.message}`);
    if (!line.ok) failed += 1;
  }
  log(failed === 0 ? `\n${lines.length} assertions passed` : `\n${failed} assertion(s) failed`);
  return failed;
}
