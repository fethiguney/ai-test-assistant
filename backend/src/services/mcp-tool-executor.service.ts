/**
 * MCP Tool Executor Service
 *
 * Single Responsibility: Map test steps to official Playwright MCP tools
 * and execute them via the MCP protocol
 */

import { TestStep, TestStepResult, PageSnapshot, DOMElement, SnapshotSummary } from "../types/index.js";

interface MCPToolCall {
  tool: string;
  arguments: Record<string, any>;
}

export class MCPToolExecutorService {
  /**
   * Convert test step to MCP tool call
   */
  convertStepToMCPTool(step: TestStep): MCPToolCall {
    switch (step.action) {
      case "goto":
      case "navigate":
        return {
          tool: "browser_navigate",
          arguments: {
            url: step.target || step.value || "",
          },
        };

      case "click":
        return {
          tool: "browser_click",
          arguments: {
            element: step.description || step.target || "element",
            ref: step.target || "",
          },
        };

      case "type":
      case "fill":
        return {
          tool: "browser_type",
          arguments: {
            element: step.description || step.target || "input field",
            ref: step.target || "",
            text: step.value || "",
          },
        };

      case "select":
        return {
          tool: "browser_select_option",
          arguments: {
            element: step.description || step.target || "dropdown",
            ref: step.target || "",
            values: [step.value || ""],
          },
        };

      case "check":
      case "uncheck":
        return {
          tool: "browser_click",
          arguments: {
            element: step.description || step.target || "checkbox",
            ref: step.target || "",
          },
        };

      case "press":
        return {
          tool: "browser_press_key",
          arguments: {
            key: step.value || "",
          },
        };

      case "wait":
        return {
          tool: "browser_wait_for",
          arguments: {
            time: step.timeout ? step.timeout / 1000 : 1,
          },
        };

      case "verify":
        return {
          tool: "browser_snapshot",
          arguments: {},
        };

      case "screenshot":
        return {
          tool: "browser_take_screenshot",
          arguments: {
            type: "png",
          },
        };

      default:
        throw new Error(`Unsupported action: ${step.action}`);
    }
  }

  /**
   * Execute MCP tool via Playwright MCP connection
   *
   * Note: This is a simplified version. In a full implementation,
   * we would use the MCP client to call tools directly.
   */
  async executeMCPTool(
    mcpConnection: any,
    toolCall: MCPToolCall
  ): Promise<any> {
    // In a full implementation, we would:
    // 1. Use mcpClient.request() to call the tool
    // 2. Handle the response
    // 3. Return structured result

    // For now, return a mock successful result
    return {
      success: true,
      tool: toolCall.tool,
      arguments: toolCall.arguments,
    };
  }

  /**
   * Convert MCP tool result to test step result
   */
  convertMCPResultToStepResult(
    step: TestStep,
    mcpResult: any,
    duration: number
  ): TestStepResult {
    return {
      step: step,
      status: mcpResult.success ? "passed" : "failed",
      duration,
      error: mcpResult.error,
      screenshot: mcpResult.screenshot,
    };
  }

  /**
   * Execute a test step using MCP tools
   */
  async executeStep(
    step: TestStep,
    mcpConnection: any
  ): Promise<TestStepResult> {
    const startTime = Date.now();

    try {
      // Convert step to MCP tool call
      const toolCall = this.convertStepToMCPTool(step);

      // Execute via MCP
      const mcpResult = await this.executeMCPTool(mcpConnection, toolCall);

      // Convert result
      const duration = Date.now() - startTime;
      return this.convertMCPResultToStepResult(step, mcpResult, duration);
    } catch (error) {
      const duration = Date.now() - startTime;
      return {
        step: step,
        status: "failed",
        duration,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Execute multiple steps sequentially
   */
  async executeSteps(
    steps: TestStep[],
    mcpConnection: any
  ): Promise<TestStepResult[]> {
    const results: TestStepResult[] = [];

    for (const step of steps) {
      const result = await this.executeStep(step, mcpConnection);
      results.push(result);

      // Stop on error if configured
      if (result.status === "failed") {
        console.warn(`[MCPToolExecutor] Step failed: ${step.action}`);
        // Continue for now, but could break here if desired
      }
    }

    return results;
  }

  /**
   * Get all available MCP tools
   */
  getAvailableMCPTools(): string[] {
    return [
      "browser_navigate",
      "browser_click",
      "browser_type",
      "browser_select_option",
      "browser_press_key",
      "browser_wait_for",
      "browser_snapshot",
      "browser_take_screenshot",
      "browser_close",
      "browser_resize",
      "browser_hover",
      "browser_drag",
      "browser_fill_form",
      "browser_handle_dialog",
      "browser_console_messages",
      "browser_network_requests",
      "browser_tabs",
    ];
  }

  /**
   * Capture page snapshot using browser_snapshot MCP tool
   *
   * @param mcpConnection - Active MCP connection
   * @returns PageSnapshot with structured page data
   */
  async capturePageSnapshot(mcpConnection: any): Promise<PageSnapshot> {
    try {
      // Call browser_snapshot MCP tool
      const toolCall: MCPToolCall = {
        tool: "browser_snapshot",
        arguments: {},
      };

      const snapshotResult = await this.executeMCPTool(mcpConnection, toolCall);

      // Parse the accessibility tree from MCP response
      const elements = this.parseAccessibilityTree(snapshotResult);

      // Extract page metadata
      const pageSnapshot: PageSnapshot = {
        url: snapshotResult.url || "",
        title: snapshotResult.title || "",
        elements: elements,
        timestamp: new Date(),
      };

      return pageSnapshot;
    } catch (error) {
      console.error("[MCPToolExecutor] Failed to capture page snapshot:", error);
      throw error;
    }
  }

  /**
   * Parse accessibility tree from MCP browser_snapshot response
   *
   * @param snapshotResult - Raw MCP snapshot result
   * @returns Array of structured DOM elements
   */
  private parseAccessibilityTree(snapshotResult: any): DOMElement[] {
    const elements: DOMElement[] = [];

    try {
      // MCP browser_snapshot returns accessibility tree
      // We need to traverse it and extract interactive elements
      const accessibilityTree = snapshotResult.snapshot || snapshotResult.data || snapshotResult;

      if (accessibilityTree && typeof accessibilityTree === "object") {
        this.extractElementsFromTree(accessibilityTree, elements);
      }
    } catch (error) {
      console.warn("[MCPToolExecutor] Error parsing accessibility tree:", error);
    }

    return elements;
  }

  /**
   * Recursively extract DOM elements from accessibility tree
   *
   * @param node - Current node in accessibility tree
   * @param elements - Array to collect extracted elements
   * @param path - Current path for generating selectors
   */
  private extractElementsFromTree(
    node: any,
    elements: DOMElement[],
    path: string = ""
  ): void {
    if (!node || typeof node !== "object") return;

    // Extract element data if it's an interactive element
    if (this.isInteractiveElement(node)) {
      const element = this.nodeToElement(node, path);
      if (element) {
        elements.push(element);
      }
    }

    // Recursively process children
    if (node.children && Array.isArray(node.children)) {
      node.children.forEach((child: any, index: number) => {
        const childPath = path ? `${path} > ${index}` : `${index}`;
        this.extractElementsFromTree(child, elements, childPath);
      });
    }
  }

  /**
   * Check if a node represents an interactive element
   *
   * @param node - Accessibility tree node
   * @returns true if element is interactive
   */
  private isInteractiveElement(node: any): boolean {
    const interactiveRoles = [
      "button",
      "link",
      "textbox",
      "combobox",
      "checkbox",
      "radio",
      "tab",
      "menuitem",
      "searchbox",
      "slider",
      "spinbutton",
      "switch",
    ];

    const interactiveTags = [
      "button",
      "a",
      "input",
      "select",
      "textarea",
      "summary",
    ];

    const role = node.role?.toLowerCase();
    const tag = node.tag?.toLowerCase() || node.name?.toLowerCase();

    return (
      (role && interactiveRoles.includes(role)) ||
      (tag && interactiveTags.includes(tag)) ||
      node.clickable === true ||
      node.focusable === true
    );
  }

  /**
   * Convert accessibility tree node to DOMElement
   *
   * @param node - Accessibility tree node
   * @param path - Path for generating selector
   * @returns DOMElement or null
   */
  private nodeToElement(node: any, path: string): DOMElement | null {
    try {
      // Build selector (prefer semantic selectors)
      const selector = this.buildSelector(node);

      // Extract text content
      const text = node.name || node.text || node.value || "";

      // Extract attributes
      const attributes: Record<string, string> = {};
      if (node.id) attributes.id = node.id;
      if (node.className) attributes.class = node.className;
      if (node.type) attributes.type = node.type;
      if (node.href) attributes.href = node.href;
      if (node.placeholder) attributes.placeholder = node.placeholder;
      if (node.value) attributes.value = node.value;

      const element: DOMElement = {
        tag: node.tag || node.name || "unknown",
        selector: selector,
        text: text,
        role: node.role,
        ariaLabel: node.ariaLabel || node["aria-label"],
        attributes: attributes,
      };

      return element;
    } catch (error) {
      console.warn("[MCPToolExecutor] Error converting node to element:", error);
      return null;
    }
  }

  /**
   * Build a semantic selector for an element
   *
   * Priority:
   * 1. data-testid
   * 2. id
   * 3. aria-label
   * 4. role + name
   * 5. text content
   * 6. CSS selector (fallback)
   *
   * @param node - Accessibility tree node
   * @returns Selector string
   */
  private buildSelector(node: any): string {
    // Priority 1: data-testid
    if (node.testId || node["data-testid"]) {
      return `[data-testid="${node.testId || node["data-testid"]}"]`;
    }

    // Priority 2: id
    if (node.id) {
      return `#${node.id}`;
    }

    // Priority 3: aria-label
    if (node.ariaLabel || node["aria-label"]) {
      return `[aria-label="${node.ariaLabel || node["aria-label"]}"]`;
    }

    // Priority 4: role + accessible name
    if (node.role && node.name) {
      return `role=${node.role}[name="${node.name}"]`;
    }

    // Priority 5: text content (for buttons, links)
    if (node.name && (node.role === "button" || node.role === "link")) {
      return `text=${node.name}`;
    }

    // Priority 6: CSS selector fallback
    if (node.tag) {
      let selector = node.tag;
      if (node.className) {
        selector += `.${node.className.split(" ")[0]}`;
      }
      return selector;
    }

    return "unknown";
  }

  /**
   * Extract snapshot summary for human-in-loop approval
   *
   * @param snapshot - Full page snapshot
   * @param topElementCount - Number of top elements to include
   * @returns Snapshot summary for display
   */
  extractSnapshotSummary(
    snapshot: PageSnapshot,
    topElementCount: number = 20
  ): SnapshotSummary {
    const interactiveElements = {
      buttons: 0,
      inputs: 0,
      links: 0,
      selects: 0,
    };

    // Count interactive elements by type
    snapshot.elements.forEach((element) => {
      if (element.role === "button" || element.tag === "button") {
        interactiveElements.buttons++;
      } else if (
        element.role === "textbox" ||
        element.tag === "input" ||
        element.tag === "textarea"
      ) {
        interactiveElements.inputs++;
      } else if (element.role === "link" || element.tag === "a") {
        interactiveElements.links++;
      } else if (element.role === "combobox" || element.tag === "select") {
        interactiveElements.selects++;
      }
    });

    // Get top elements (most likely to be useful)
    const topElements = snapshot.elements.slice(0, topElementCount);

    return {
      url: snapshot.url,
      title: snapshot.title,
      elementCount: snapshot.elements.length,
      interactiveElements,
      topElements,
    };
  }

  /**
   * Format page snapshot for LLM context
   *
   * Creates a concise text representation of the page structure
   * for use in LLM prompts during iterative test generation
   *
   * @param snapshot - Page snapshot
   * @returns Formatted string for LLM context
   */
  formatSnapshotForLLM(snapshot: PageSnapshot): string {
    const lines: string[] = [];

    lines.push(`Page: ${snapshot.title}`);
    lines.push(`URL: ${snapshot.url}`);
    lines.push(`Elements found: ${snapshot.elements.length}`);
    lines.push("");
    lines.push("Interactive Elements:");
    lines.push("");

    // Group elements by type
    const byType: Record<string, DOMElement[]> = {};
    snapshot.elements.forEach((element) => {
      const type = element.role || element.tag;
      if (!byType[type]) {
        byType[type] = [];
      }
      byType[type].push(element);
    });

    // Format each type
    Object.entries(byType).forEach(([type, elements]) => {
      lines.push(`${type.toUpperCase()}:`);
      elements.forEach((element, index) => {
        const text = element.text ? ` "${element.text}"` : "";
        const ariaLabel = element.ariaLabel ? ` [${element.ariaLabel}]` : "";
        lines.push(`  ${index + 1}. ${element.selector}${text}${ariaLabel}`);
      });
      lines.push("");
    });

    return lines.join("\n");
  }
}
