import { test, expect } from "@playwright/test";

test("basic login page check", async ({ page }) => {
  await page.goto("https://the-internet.herokuapp.com/login");

  await expect(page.locator("#username")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
  await expect(page.locator("button[type='submit']")).toBeVisible();
});
