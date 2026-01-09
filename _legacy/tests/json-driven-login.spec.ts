import { test } from "@playwright/test";
import fs from "fs";
import path from "path";
import { executeSteps } from "../src/stepExecutor";
import { TestStep } from "../src/testSteps";

test("login test driven by JSON steps", async ({ page }) => {
  const stepsPath = path.join(__dirname, "login.steps.json");
  const steps = JSON.parse(fs.readFileSync(stepsPath, "utf-8")) as TestStep[];

  await executeSteps(page, steps);
});
