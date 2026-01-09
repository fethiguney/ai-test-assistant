import { Page, expect } from "@playwright/test";
import { TestStep } from "./testSteps";
import { selectorMap } from "./selectorMap";

export async function executeSteps(page: Page, steps: TestStep[]) {
  console.log("EXECUTING STEPS:", steps);
  for (const step of steps) {
    switch (step.action) {
      case "goto":
        await page.goto(selectorMap[step.page].url, 
          { waitUntil: "domcontentloaded",timeout: 30_000,});
        break;

      case "fill":
        await page.fill(
          selectorMap.loginPage[step.field],
          step.value
        );
        break;

      case "click":
        await page.click(
          selectorMap.loginPage[step.element]
        );
        break;

      case "expectVisible":
        await expect(
          page.locator(selectorMap.loginPage[step.element])
        ).toBeVisible();
        break;
    }
  }
}
