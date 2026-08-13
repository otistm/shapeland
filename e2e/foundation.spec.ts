import { expect, test } from "@playwright/test";

test("foundation boots a toon cube on the white grid", async ({ page }) => {
  await page.goto("/?gl=1");
  const canvas = page.locator("#view");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("data-backend", /webgpu|webgl2/, { timeout: 30_000 });
  await expect(page.locator("[data-hud=shell]")).toContainText("phase 8");
  await expect(page.locator("#pips i")).toHaveCount(3);
  await expect(page.locator("#stick")).toBeVisible();
  await expect(page.locator("#pivot")).toBeVisible();
  await expect(page.locator("#dpad polygon.frame")).toBeVisible();
});

test("equip overlay opens the cross net and commits on DONE", async ({ page }) => {
  await page.goto("/?gl=1");
  await expect(page.locator("#equipBtn")).toBeVisible({ timeout: 30_000 });
  await page.locator("#equipBtn").click();
  await expect(page.locator("#equip")).toHaveClass(/open/);
  await expect(page.locator("#net .slot")).toHaveCount(6);
  await expect(page.locator("#equip")).toContainText("Nothing found yet");
  await page.locator("#equipDone").click();
  await expect(page.locator("#equip")).not.toHaveClass(/open/);
});
