import { expect, test } from "@playwright/test";

test("foundation boots a toon cube on the white grid", async ({ page }) => {
  await page.goto("/?gl=1");
  const canvas = page.locator("#view");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-backend", /webgpu|webgl2/, { timeout: 30_000 });
  await expect(page.locator("[data-hud=shell]")).toContainText("phase 2");
  await expect(page.locator("#pips i")).toHaveCount(3);
});
