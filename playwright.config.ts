import { defineConfig, devices } from "@playwright/test";

const port = process.env.CI ? 4173 : 5173;
const command = process.env.CI
  ? "pnpm --filter @shapeland/web preview --host 127.0.0.1"
  : "pnpm --filter @shapeland/web dev --host 127.0.0.1 --port 5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
