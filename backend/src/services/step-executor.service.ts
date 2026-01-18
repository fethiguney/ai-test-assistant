/**
 * Step Executor Service
 *
 * Single Responsibility: Execute test steps using Playwright
 */

import {
  chromium,
  firefox,
  webkit,
  Browser,
  Page,
  expect,
} from "@playwright/test";
import {
  TestStep,
  TestStepResult,
  TestExecutionResult,
  TestExecutionRequest,
  BrowserType,
  PageSnapshot,
  DOMElement,
} from "../types/index.js";

export class StepExecutorService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private persistBrowser: boolean = false;

  /**
   * Enable persistent browser mode - browser stays open between execute() calls
   * Useful for human-in-loop testing where steps are executed one by one
   */
  enablePersistentBrowser(): void {
    this.persistBrowser = true;
  }

  /**
   * Disable persistent browser mode
   */
  disablePersistentBrowser(): void {
    this.persistBrowser = false;
  }

  /**
   * Check if browser is currently open
   */
  isBrowserOpen(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get the current page instance (for snapshot capture, etc.)
   * Only available when browser is open
   */
  getCurrentPage(): Page | null {
    return this.page;
  }

  /**
   * Capture a page snapshot for iterative test generation
   * Uses Playwright's DOM APIs to extract page structure
   * 
   * @returns PageSnapshot with URL, title, and extracted DOM elements
   */
  async capturePageSnapshot(): Promise<PageSnapshot> {
    if (!this.page) {
      throw new Error('Cannot capture snapshot: browser not initialized');
    }

    try {
      // Get page metadata
      const url = this.page.url();
      const title = await this.page.title();

      // Extract DOM elements from the page
      const elements = await this.extractDOMElements(this.page);

      return {
        url,
        title,
        elements,
        timestamp: new Date(),
      };
    } catch (error) {
      console.error('[StepExecutor] Failed to capture page snapshot:', error);
      throw new Error(`Snapshot capture failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Extract DOM elements from the page
   * Focuses on interactive elements relevant for test generation
   */
  private async extractDOMElements(page: Page): Promise<DOMElement[]> {
    const elements: DOMElement[] = [];

    try {
      // Extract interactive elements using Playwright's locator API
      // We'll query for common interactive elements

      // 1. Extract buttons
      const buttons = await page.locator('button, [role="button"], input[type="button"], input[type="submit"]').all();
      for (const button of buttons) {
        const element = await this.createDOMElementFromLocator(button, 'button');
        if (element) elements.push(element);
      }

      // 2. Extract input fields
      const inputs = await page.locator('input:not([type="button"]):not([type="submit"]), textarea, [role="textbox"]').all();
      for (const input of inputs) {
        const element = await this.createDOMElementFromLocator(input, 'input');
        if (element) elements.push(element);
      }

      // 3. Extract links
      const links = await page.locator('a[href], [role="link"]').all();
      for (const link of links) {
        const element = await this.createDOMElementFromLocator(link, 'a');
        if (element) elements.push(element);
      }

      // 4. Extract select/dropdown elements
      const selects = await page.locator('select, [role="combobox"], [role="listbox"]').all();
      for (const select of selects) {
        const element = await this.createDOMElementFromLocator(select, 'select');
        if (element) elements.push(element);
      }

      // 5. Extract checkboxes and radio buttons
      const checkboxes = await page.locator('input[type="checkbox"], input[type="radio"], [role="checkbox"], [role="radio"]').all();
      for (const checkbox of checkboxes) {
        const element = await this.createDOMElementFromLocator(checkbox, 'input');
        if (element) elements.push(element);
      }

      // 6. Extract headings for context
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
      for (const heading of headings) {
        const element = await this.createDOMElementFromLocator(heading, 'heading');
        if (element) elements.push(element);
      }

    } catch (error) {
      console.error('[StepExecutor] Error extracting DOM elements:', error);
    }

    return elements;
  }

  /**
   * Create a DOMElement from a Playwright locator
   */
  private async createDOMElementFromLocator(locator: any, fallbackTag: string): Promise<DOMElement | null> {
    try {
      // Get element properties
      const tag = await locator.evaluate((el: HTMLElement) => el.tagName.toLowerCase()).catch(() => fallbackTag);
      const text = await locator.textContent().catch(() => '');
      const isVisible = await locator.isVisible().catch(() => false);

      // Skip invisible elements
      if (!isVisible) return null;

      // Get attributes
      const attributes: Record<string, string> = {};
      const attrNames = ['id', 'class', 'name', 'type', 'value', 'placeholder', 'href', 'src', 'alt', 'data-testid', 'aria-label', 'aria-describedby'];
      
      for (const attrName of attrNames) {
        try {
          const value = await locator.getAttribute(attrName);
          if (value) attributes[attrName] = value;
        } catch {
          // Attribute doesn't exist, skip
        }
      }

      // Get role
      const role = await locator.getAttribute('role').catch(() => null) || 
                   await locator.evaluate((el: HTMLElement) => {
                     // Map common tags to implicit roles
                     const roleMap: Record<string, string> = {
                       'button': 'button',
                       'a': 'link',
                       'input': el.getAttribute('type') === 'checkbox' ? 'checkbox' : 'textbox',
                       'textarea': 'textbox',
                       'select': 'combobox',
                     };
                     return roleMap[el.tagName.toLowerCase()] || '';
                   }).catch(() => '');

      // Generate optimal selector
      const selector = this.generateOptimalSelector(attributes, tag, text, role);

      const element: DOMElement = {
        tag,
        selector,
        text: text?.trim() || undefined,
        role: role || undefined,
        ariaLabel: attributes['aria-label'] || undefined,
        attributes,
      };

      return element;
    } catch (error) {
      // Failed to extract this element, skip it
      return null;
    }
  }

  /**
   * Generate an optimal selector based on element properties
   * Prioritizes accessible and stable selectors
   */
  private generateOptimalSelector(
    attributes: Record<string, string>,
    tag: string,
    text: string | null,
    role: string
  ): string {
    // Priority 1: data-testid (most stable)
    if (attributes['data-testid']) {
      return `[data-testid="${attributes['data-testid']}"]`;
    }

    // Priority 2: id (stable if not dynamic)
    if (attributes['id'] && !attributes['id'].match(/\d{10,}/)) {
      return `#${attributes['id']}`;
    }

    // Priority 3: aria-label (accessible)
    if (attributes['aria-label']) {
      return `[aria-label="${attributes['aria-label']}"]`;
    }

    // Priority 4: name attribute (for form elements)
    if (attributes['name']) {
      return `[name="${attributes['name']}"]`;
    }

    // Priority 5: placeholder (for inputs)
    if (attributes['placeholder']) {
      return `[placeholder="${attributes['placeholder']}"]`;
    }

    // Priority 6: role + text (for buttons/links)
    if (role && text && text.trim().length > 0 && text.length < 50) {
      const cleanText = text.trim().substring(0, 50);
      if (role === 'button') {
        return `button:has-text("${cleanText}")`;
      } else if (role === 'link') {
        return `a:has-text("${cleanText}")`;
      }
    }

    // Priority 7: text content for interactive elements
    if (text && text.trim().length > 0 && text.length < 50) {
      const cleanText = text.trim();
      if (tag === 'button' || tag === 'a') {
        return `${tag}:has-text("${cleanText}")`;
      }
    }

    // Priority 8: type attribute for inputs
    if (tag === 'input' && attributes['type']) {
      if (attributes['name']) {
        return `input[type="${attributes['type']}"][name="${attributes['name']}"]`;
      }
      return `input[type="${attributes['type']}"]`;
    }

    // Priority 9: class (less stable but common)
    if (attributes['class']) {
      const classes = attributes['class'].split(' ').filter(c => c.length > 0);
      if (classes.length > 0 && !classes[0].match(/\d{10,}/)) {
        return `.${classes[0]}`;
      }
    }

    // Fallback: tag name
    return tag;
  }

  async execute(request: TestExecutionRequest): Promise<TestExecutionResult> {
    const startTime = Date.now();
    const results: TestStepResult[] = [];
    let overallStatus: TestExecutionResult["status"] = "passed";

    try {
      // Extract browser type from request options (default to chromium)
      const browserType = request.browser || "chromium";
      const headless = request.options?.headless ?? false; // Default to visible browser

      // Launch browser only if not already open
      if (!this.isBrowserOpen()) {
        await this.launchBrowser(browserType, headless);
      }

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
      // Only cleanup if not in persistent mode
      if (!this.persistBrowser) {
        await this.cleanup();
      }
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

  private async launchBrowser(
    browserType: BrowserType,
    headless: boolean
  ): Promise<void> {
    // Select and launch the appropriate browser
    switch (browserType) {
      case "chromium":
        this.browser = await chromium.launch({ headless });
        break;
      case "firefox":
        this.browser = await firefox.launch({ headless });
        break;
      case "webkit":
        this.browser = await webkit.launch({ headless });
        break;
      default:
        throw new Error(`Unsupported browser type: ${browserType}`);
    }

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

  /**
   * Manually close the browser (for persistent mode)
   */
  async closeBrowser(): Promise<void> {
    await this.cleanup();
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
