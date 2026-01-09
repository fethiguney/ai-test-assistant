/**
 * Step Executor Service
 *
 * Single Responsibility: Execute test steps using Playwright
 */

import { chromium, Browser, Page, expect } from "@playwright/test";
import {
  TestStep,
  TestStepResult,
  TestExecutionResult,
  TestExecutionRequest,
} from "../types/index.js";

export class StepExecutorService {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async execute(request: TestExecutionRequest): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const results: TestStepResult[] = [];
    let overallStatus: TestExecutionResult["status"] = "passed";

    try {
      // Launch browser
      await this.launchBrowser(request.options?.headless ?? true);

      // Execute each step
      for (const step of request.steps) {
        const result = await this.executeStep(step, request.options);
        results.push(result);

        if (result.status === "failed") {
          overallStatus = "failed";
          break; // Stop on first failure
        }
      }
    } catch (error) {
      overallStatus = "error";
      console.error("[StepExecutor] Fatal error:", error);
    } finally {
      await this.cleanup();
    }

    return {
      id: this.generateId(),
      scenario: request.scenario,
      steps: results,
      status: overallStatus,
      totalDuration: Date.now() - startTime,
      startedAt: new Date(startTime),
      completedAt: new Date(),
    };
  }

  private async launchBrowser(headless: boolean): Promise<void> {
    this.browser = await chromium.launch({ headless });
    this.page = await this.browser.newPage();
  }

  private async executeStep(
    step: TestStep,
    options?: TestExecutionRequest["options"]
  ): Promise<TestStepResult> {
    const startTime = Date.now();
    const result: TestStepResult = {
      step,
      status: "running",
      duration: 0,
    };

    if (!this.page) {
      result.status = "failed";
      result.error = "Browser not initialized";
      return result;
    }

    try {
      await this.performAction(step, this.page, options);
      result.status = "passed";
    } catch (error) {
      result.status = "failed";
      result.error = error instanceof Error ? error.message : "Unknown error";

      // Take screenshot on failure
      if (options?.screenshot) {
        try {
          const screenshotBuffer = await this.page.screenshot({
            fullPage: true,
          });
          result.screenshot = screenshotBuffer.toString("base64");
        } catch {}
      }
    } finally {
      result.duration = Date.now() - startTime;
    }

    return result;
  }

  private async performAction(
    step: TestStep,
    page: Page,
    options?: TestExecutionRequest["options"]
  ): Promise<void> {
    const timeout = step.timeout || options?.timeout || 30000;

    switch (step.action) {
      case "goto":
        if (!step.target) throw new Error("goto: target URL required");
        await page.goto(step.target, {
          timeout,
          waitUntil: "domcontentloaded",
        });
        break;

      case "fill":
        if (!step.target) throw new Error("fill: target selector required");
        if (!step.value) throw new Error("fill: value required");
        await page.fill(step.target, step.value, { timeout });
        break;

      case "click":
        if (!step.target) throw new Error("click: target selector required");
        await page.click(step.target, { timeout });
        break;

      case "hover":
        if (!step.target) throw new Error("hover: target selector required");
        await page.hover(step.target, { timeout });
        break;

      case "select":
        if (!step.target) throw new Error("select: target selector required");
        if (!step.value) throw new Error("select: value required");
        await page.selectOption(step.target, step.value, { timeout });
        break;

      case "check":
        if (!step.target) throw new Error("check: target selector required");
        await page.check(step.target, { timeout });
        break;

      case "uncheck":
        if (!step.target) throw new Error("uncheck: target selector required");
        await page.uncheck(step.target, { timeout });
        break;

      case "expectVisible":
        if (!step.target)
          throw new Error("expectVisible: target selector required");
        await expect(page.locator(step.target)).toBeVisible({ timeout });
        break;

      case "expectHidden":
        if (!step.target)
          throw new Error("expectHidden: target selector required");
        await expect(page.locator(step.target)).toBeHidden({ timeout });
        break;

      case "expectText":
        if (!step.target)
          throw new Error("expectText: target selector required");
        if (!step.value) throw new Error("expectText: expected text required");
        await expect(page.locator(step.target)).toContainText(step.value, {
          timeout,
        });
        break;

      case "expectUrl":
        if (!step.value) throw new Error("expectUrl: expected URL required");
        await expect(page).toHaveURL(step.value, { timeout });
        break;

      case "wait":
        const waitTime = step.value ? parseInt(step.value, 10) : 1000;
        await page.waitForTimeout(waitTime);
        break;

      case "screenshot":
        const screenshotPath = step.value || "screenshot.png";
        await page.screenshot({ path: screenshotPath, fullPage: true });
        break;

      case "scroll":
        if (step.target) {
          await page.locator(step.target).scrollIntoViewIfNeeded({ timeout });
        } else {
          // Scroll to bottom of page
          await page.evaluate("window.scrollTo(0, document.body.scrollHeight)");
        }
        break;

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
      this.page = null;
    }
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }

  private generateId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// Factory
export function createStepExecutorService(): StepExecutorService {
  return new StepExecutorService();
}
