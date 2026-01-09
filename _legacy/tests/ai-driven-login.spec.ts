import { test } from "@playwright/test";
import { generateTestSteps } from "../src/llmClient";
import { executeSteps } from "../src/stepExecutor";
import { TestStep } from "../src/testSteps";
import { normalizeAiSteps } from "../src/aiNormalizer";
import { extractJson } from "../src/llmClient";

test("AI driven login test", async ({ page }) => {
  const manualScenario = `
User goes to login page
User enters valid username "tomsmith"
User enters valid password "SuperSecretPassword!"
User clicks login button
Login success message should be visible
  `;

const jsonStepsText = await generateTestSteps(manualScenario);
console.log("AI RESPONSE:", jsonStepsText);

const cleanJson = extractJson(jsonStepsText);
const rawSteps = JSON.parse(cleanJson);

const steps = normalizeAiSteps(rawSteps);
await executeSteps(page, steps);

  
});
