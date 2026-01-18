/**
 * Test Generator Service
 *
 * Single Responsibility: Convert natural language to test steps
 *
 * Follows Dependency Inversion: Depends on ILLMProvider interface, not concrete classes
 */

import {
  ILLMProvider,
  LLMRequestOptions,
  TestGenerationRequest,
  TestGenerationResponse,
  TestStep,
  IterativeStepRequest,
  PageSnapshot,
  DOMElement,
} from "../types/index.js";
import { LLMManager } from "../llm/llm-manager.js";

export class TestGeneratorService {
  constructor(private readonly llmManager: LLMManager) {}

  /**
   * Generate test steps from natural language scenario
   */
  async generateSteps(
    request: TestGenerationRequest
  ): Promise<TestGenerationResponse> {
    const provider = this.llmManager.getActiveProvider();

    if (!provider) {
      throw new Error("No active LLM provider available");
    }

    const systemPrompt = this.buildSystemPrompt(request.context);
    const options: LLMRequestOptions = {
      temperature: 0.3, // Lower temperature for more deterministic output
      maxTokens: 2048,
      timeout: 120000, // 2 min timeout for local LLMs
    };

    const response = await provider.generate(
      request.scenario,
      systemPrompt,
      options
    );
    const steps = this.parseSteps(response.content);

    return {
      steps,
      rawResponse: response.content,
      model: response.model,
      provider: response.provider,
      latencyMs: response.latencyMs,
    };
  }

  /**
   * Parse scenario into abstract intentions for iterative generation
   */
  async parseScenarioIntent(scenario: string): Promise<string[]> {
    const provider = this.llmManager.getActiveProvider();

    if (!provider) {
      throw new Error("No active LLM provider available");
    }

    const systemPrompt = `You are an expert QA automation engineer.
Break down the given test scenario into a list of abstract high-level intentions.
Each intention should be a single, clear action or verification goal.

STRICT RULES:
1. Return ONLY a valid JSON array of strings - no explanations, no markdown
2. Keep intentions abstract - do NOT specify selectors or DOM details
3. Each intention should be ONE testable action or verification
4. Use simple, clear language

EXAMPLE INPUT:
"Log in to the app with valid credentials and verify the dashboard loads"

EXAMPLE OUTPUT:
["Navigate to login page", "Enter valid username", "Enter valid password", "Submit login form", "Verify dashboard is visible"]

Now break down the following scenario into abstract intentions:`;

    const options: LLMRequestOptions = {
      temperature: 0.2, // Very low temperature for consistent parsing
      maxTokens: 1024,
      timeout: 60000,
    };

    const response = await provider.generate(scenario, systemPrompt, options);

    // Parse the response to extract intentions
    let cleaned = response.content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    // Try to find the JSON array, being more lenient with whitespace
    const jsonMatch = cleaned.match(/\[[\s\S]*?\]/);

    if (!jsonMatch) {
      throw new Error("Could not parse intentions from LLM response");
    }

    try {
      // Extract just the JSON array part
      const jsonString = jsonMatch[0];
      const intentions = JSON.parse(jsonString);

      if (!Array.isArray(intentions) || intentions.length === 0) {
        throw new Error("Invalid intentions format");
      }

      return intentions.map(String);
    } catch (error) {
      console.error(
        "[TestGenerator] Failed to parse intentions. Response:",
        response.content
      );
      throw new Error(
        `Failed to parse intentions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Generate next concrete step with page context
   */
  async generateNextStep(request: IterativeStepRequest): Promise<TestStep> {
    const provider = this.llmManager.getActiveProvider();

    if (!provider) {
      throw new Error("No active LLM provider available");
    }

    const systemPrompt = this.buildIterativePrompt(request.currentPageSnapshot);

    // Build user prompt with context
    let userPrompt = `SCENARIO: ${request.scenario}\n\n`;

    if (request.previousSteps.length > 0) {
      userPrompt += `PREVIOUS STEPS COMPLETED:\n`;
      request.previousSteps.forEach((step, i) => {
        userPrompt += `${i + 1}. ${step.action}${
          step.target ? ` ${step.target}` : ""
        }${step.description ? ` - ${step.description}` : ""}\n`;
      });
      userPrompt += "\n";
    }

    userPrompt += "Generate the NEXT SINGLE step as JSON:";

    const options: LLMRequestOptions = {
      temperature: 0.3,
      maxTokens: 1024,
      timeout: 120000,
    };

    const response = await provider.generate(userPrompt, systemPrompt, options);

    // Try to parse as single step first, then as array
    let step: TestStep;
    try {
      step = this.parseSingleStep(response.content);
    } catch (error) {
      // Fallback to array parsing
      const steps = this.parseSteps(response.content);
      if (steps.length === 0) {
        throw new Error("No step generated by LLM");
      }
      step = steps[0];
    }

    return step;
  }

  /**
   * Build system prompt for iterative generation with page context
   */
  buildIterativePrompt(pageSnapshot?: PageSnapshot): string {
    const basePrompt = `You are an expert QA automation engineer.
Generate a SINGLE concrete test step based on the current page context.

STRICT RULES:
1. Return ONLY ONE step as a JSON object - no explanations, no markdown
2. Use these actions: goto, fill, click, hover, select, check, expectVisible, expectText, expectUrl, wait
3. The step must have: action (required), target (selector/url), value (for inputs), description (human readable)
4. For navigation intentions (navigate, go to, open, visit, load, browse), ALWAYS use "goto" action with the full URL as the target
5. Extract the actual URL from the scenario context - do NOT make up URLs
6. ALWAYS use selectors from the provided page elements when available
7. Prioritize accessible selectors in this order:
   a) data-testid attribute
   b) role + aria-label combination
   c) role + accessible name
   d) id attribute
   e) text content (for buttons/links)
   f) CSS selectors as last resort`;

    const parts = [basePrompt];

    if (pageSnapshot) {
      parts.push(this.formatPageContext(pageSnapshot));
    }

    const example = `
EXAMPLE OUTPUT (single step as JSON object):
{"action":"click","target":"button[role=button][aria-label='Sign in']","description":"Click sign in button"}

OR if returning an array with one element:
[{"action":"fill","target":"#email","value":"test@example.com","description":"Enter email address"}]`;

    parts.push(example);
    parts.push(
      "\nGenerate the next step based on the scenario and page context:"
    );

    return parts.join("\n\n");
  }

  /**
   * Format page context for LLM prompt
   */
  private formatPageContext(snapshot: PageSnapshot): string {
    const parts: string[] = [];

    parts.push(`CURRENT PAGE CONTEXT:`);
    parts.push(`URL: ${snapshot.url}`);
    parts.push(`Title: ${snapshot.title}`);
    parts.push(`\nAVAILABLE INTERACTIVE ELEMENTS:`);

    // Group elements by type
    const buttons = snapshot.elements.filter(
      (el) =>
        el.role === "button" ||
        el.tag === "button" ||
        (el.tag === "input" &&
          ["submit", "button"].includes(el.attributes.type || ""))
    );

    const inputs = snapshot.elements.filter(
      (el) =>
        el.tag === "input" &&
        !["submit", "button"].includes(el.attributes.type || "")
    );

    const links = snapshot.elements.filter(
      (el) => el.tag === "a" || el.role === "link"
    );

    const selects = snapshot.elements.filter(
      (el) => el.tag === "select" || el.role === "combobox"
    );

    const checkboxes = snapshot.elements.filter(
      (el) => el.tag === "input" && el.attributes.type === "checkbox"
    );

    // Format each group
    if (buttons.length > 0) {
      parts.push(`\nBUTTONS (${buttons.length}):`);
      buttons.slice(0, 10).forEach((btn) => {
        parts.push(`  - ${this.formatElement(btn)}`);
      });
      if (buttons.length > 10) {
        parts.push(`  ... and ${buttons.length - 10} more buttons`);
      }
    }

    if (inputs.length > 0) {
      parts.push(`\nINPUT FIELDS (${inputs.length}):`);
      inputs.slice(0, 10).forEach((input) => {
        parts.push(`  - ${this.formatElement(input)}`);
      });
      if (inputs.length > 10) {
        parts.push(`  ... and ${inputs.length - 10} more inputs`);
      }
    }

    if (links.length > 0) {
      parts.push(`\nLINKS (${links.length}):`);
      links.slice(0, 10).forEach((link) => {
        parts.push(`  - ${this.formatElement(link)}`);
      });
      if (links.length > 10) {
        parts.push(`  ... and ${links.length - 10} more links`);
      }
    }

    if (selects.length > 0) {
      parts.push(`\nDROPDOWNS (${selects.length}):`);
      selects.forEach((select) => {
        parts.push(`  - ${this.formatElement(select)}`);
      });
    }

    if (checkboxes.length > 0) {
      parts.push(`\nCHECKBOXES (${checkboxes.length}):`);
      checkboxes.forEach((checkbox) => {
        parts.push(`  - ${this.formatElement(checkbox)}`);
      });
    }

    return parts.join("\n");
  }

  /**
   * Format a single element for display in prompt
   */
  private formatElement(element: DOMElement): string {
    const parts: string[] = [];

    // Selector (most important)
    parts.push(`selector: "${element.selector}"`);

    // Add identifying info
    if (element.ariaLabel) {
      parts.push(`label: "${element.ariaLabel}"`);
    }

    if (element.text && element.text.trim().length > 0) {
      const truncated = element.text.trim().substring(0, 50);
      parts.push(
        `text: "${truncated}${element.text.length > 50 ? "..." : ""}"`
      );
    }

    if (element.attributes.placeholder) {
      parts.push(`placeholder: "${element.attributes.placeholder}"`);
    }

    if (element.attributes.type) {
      parts.push(`type: "${element.attributes.type}"`);
    }

    if (element.attributes.name) {
      parts.push(`name: "${element.attributes.name}"`);
    }

    return parts.join(", ");
  }

  /**
   * Build system prompt for test generation
   */
  private buildSystemPrompt(
    context?: TestGenerationRequest["context"]
  ): string {
    const basePrompt = `You are an expert QA automation engineer.
Convert the given test scenario into structured JSON test steps.

STRICT RULES:
1. Return ONLY a valid JSON array - no explanations, no markdown
2. Use these standard actions: goto, fill, click, hover, select, check, expectVisible, expectText, expectUrl, wait
3. Each step must have: action (required), target (selector/url), value (for inputs), description (human readable)
4. Use semantic selectors: #id, .class, [role="button"], [aria-label="..."], button[type="submit"]`;

    const contextParts: string[] = [];

    if (context?.allowedActions?.length) {
      contextParts.push(
        `ALLOWED ACTIONS: ${context.allowedActions.join(", ")}`
      );
    }

    if (context?.allowedElements?.length) {
      contextParts.push(
        `KNOWN ELEMENTS: ${context.allowedElements.join(", ")}`
      );
    }

    if (context?.pageType) {
      contextParts.push(`PAGE TYPE: ${context.pageType}`);
    }

    if (context?.baseUrl) {
      contextParts.push(`BASE URL: ${context.baseUrl}`);
    }

    if (context?.customInstructions) {
      contextParts.push(
        `ADDITIONAL INSTRUCTIONS: ${context.customInstructions}`
      );
    }

    const example = `
EXAMPLE OUTPUT:
[
  {"action":"goto","target":"https://example.com/login","description":"Navigate to login page"},
  {"action":"fill","target":"#username","value":"testuser","description":"Enter username"},
  {"action":"fill","target":"#password","value":"password123","description":"Enter password"},
  {"action":"click","target":"button[type=submit]","description":"Click login button"},
  {"action":"expectVisible","target":".welcome-message","description":"Verify login success"}
]`;

    const parts = [basePrompt];

    if (contextParts.length > 0) {
      parts.push("\n" + contextParts.join("\n"));
    }

    parts.push(example);
    parts.push("\nNow convert the following test scenario to JSON steps:");

    return parts.join("\n");
  }

  /**
   * Parse a single test step from LLM response
   */
  private parseSingleStep(content: string): TestStep {
    // Clean markdown code blocks
    let cleaned = content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    // Try to extract a single JSON object
    const objectMatch = cleaned.match(/\{[\s\S]*?\}/);

    if (!objectMatch) {
      throw new Error("Could not find JSON object in response");
    }

    try {
      const parsed = JSON.parse(objectMatch[0]);

      if (!parsed.action || typeof parsed.action !== "string") {
        throw new Error('Missing or invalid "action" field in step');
      }

      const step: TestStep = {
        action: parsed.action as string,
      };

      if (parsed.target) {
        step.target = String(parsed.target);
      }

      if (parsed.value) {
        step.value = String(parsed.value);
      }

      if (parsed.description) {
        step.description = String(parsed.description);
      }

      if (parsed.timeout && typeof parsed.timeout === "number") {
        step.timeout = parsed.timeout;
      }

      return step;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON parsing failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Parse test steps from LLM response
   */
  private parseSteps(content: string): TestStep[] {
    // Clean markdown code blocks
    let cleaned = content
      .replace(/```json\n?/gi, "")
      .replace(/```\n?/g, "")
      .trim();

    // Extract JSON array
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!jsonMatch) {
      throw new Error(
        `Invalid response format: Could not find JSON array in response`
      );
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);

      if (!Array.isArray(parsed)) {
        throw new Error("Response is not an array");
      }

      // Validate and normalize steps
      return parsed.map((step: Record<string, unknown>, index: number) => {
        if (!step.action || typeof step.action !== "string") {
          throw new Error(
            `Step ${index + 1}: Missing or invalid 'action' field`
          );
        }

        const normalizedStep: TestStep = {
          action: step.action as string,
        };

        if (step.target) {
          normalizedStep.target = String(step.target);
        }

        if (step.value) {
          normalizedStep.value = String(step.value);
        }

        if (step.description) {
          normalizedStep.description = String(step.description);
        }

        if (step.timeout && typeof step.timeout === "number") {
          normalizedStep.timeout = step.timeout;
        }

        return normalizedStep;
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`JSON parsing failed: ${error.message}`);
      }
      throw error;
    }
  }
}

// ============================================
// Factory function for dependency injection
// ============================================

export function createTestGeneratorService(
  llmManager: LLMManager
): TestGeneratorService {
  return new TestGeneratorService(llmManager);
}
