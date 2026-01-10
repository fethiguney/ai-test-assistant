/**
 * MCP Tool Executor Service
 *
 * Single Responsibility: Map test steps to official Playwright MCP tools
 * and execute them via the MCP protocol
 */

import { TestStep, TestStepResult } from "../types/index.js";

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
}
