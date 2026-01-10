/**
 * Playwright MCP Client
 *
 * Single Responsibility: Execute tests via official Playwright MCP protocol
 *
 * This client uses the official Microsoft @playwright/mcp package
 * to execute tests via the MCP protocol
 */

import { createConnection } from "@playwright/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { BaseMCPClient } from "./base-mcp-client.js";
import {
  MCPClientConfig,
  MCPExecutionRequest,
  MCPExecutionResponse,
} from "../../types/index.js";
import { StepExecutorService } from "../../services/step-executor.service.js";
import { MCPToolExecutorService } from "../../services/mcp-tool-executor.service.js";

export class PlaywrightMCPClient extends BaseMCPClient {
  private mcpConnection: any = null;
  private mcpClient: Client | null = null;
  private fallbackExecutor: StepExecutorService;
  private mcpToolExecutor: MCPToolExecutorService;
  private useFallback: boolean = false;

  constructor(config?: Partial<MCPClientConfig>) {
    const defaultConfig: MCPClientConfig = {
      type: "playwright",
      name: "Playwright MCP (Official)",
      transport: "stdio",
      isAvailable: true,
      metadata: {
        capabilities: ["web", "browser", "screenshot"],
        version: "0.0.55",
      },
    };

    super({ ...defaultConfig, ...config });
    this.fallbackExecutor = new StepExecutorService();
    this.mcpToolExecutor = new MCPToolExecutorService();
  }

  /**
   * Connect to Playwright MCP server using official package
   */
  async connect(): Promise<boolean> {
    try {
      console.log("[PlaywrightMCP] Connecting to official MCP server...");

      // Try to create MCP connection using official package
      try {
        // Create an in-process MCP connection with headless browser
        this.mcpConnection = await createConnection({
          browser: {
            launchOptions: {
              headless: true,
            },
          },
        });

        // Create MCP client for tool calls
        this.mcpClient = new Client(
          {
            name: "ai-test-assistant",
            version: "1.0.0",
          },
          {
            capabilities: {},
          }
        );

        this.connected = true;
        this.useFallback = false;
        console.log("[PlaywrightMCP] Connected to official MCP server");
        return true;
      } catch (mcpError) {
        console.warn(
          "[PlaywrightMCP] Official MCP not available, using fallback:",
          mcpError
        );
        this.useFallback = true;
        this.connected = true;
        return true;
      }
    } catch (error) {
      console.error("[PlaywrightMCP] Connection failed:", error);
      this.connected = false;
      return false;
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect(): Promise<void> {
    console.log("[PlaywrightMCP] Disconnecting...");

    if (this.mcpClient) {
      try {
        await this.mcpClient.close();
      } catch (error) {
        console.warn("[PlaywrightMCP] Error closing MCP client:", error);
      }
      this.mcpClient = null;
    }

    this.mcpConnection = null;
    this.connected = false;
  }

  /**
   * Execute test steps via MCP protocol
   *
   * Uses official Microsoft playwright-mcp tools:
   * - browser_navigate
   * - browser_type
   * - browser_click
   * - browser_snapshot
   * etc.
   */
  async executeSteps(
    request: MCPExecutionRequest
  ): Promise<MCPExecutionResponse> {
    if (!this.connected) {
      await this.connect();
    }

    console.log("[PlaywrightMCP] Executing steps via MCP protocol...");

    // If MCP is not available or we're using fallback, use direct execution
    if (this.useFallback || !this.mcpConnection) {
      console.log("[PlaywrightMCP] Using fallback executor");
      return await this.executeFallback(request);
    }

    const { result, duration } = await this.measureExecution(async () => {
      return await this.executeViaMCP(request);
    });

    const mcpResponse: MCPExecutionResponse = {
      id: this.generateExecutionId(),
      status: result.status,
      steps: result.steps,
      totalDuration: duration,
      client: "playwright",
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    };

    console.log(
      `[PlaywrightMCP] Execution completed: ${mcpResponse.status} in ${duration}ms`
    );

    return mcpResponse;
  }

  /**
   * Execute steps using official MCP tools
   */
  private async executeViaMCP(request: MCPExecutionRequest): Promise<any> {
    const startedAt = new Date();
    let overallStatus: "passed" | "failed" | "error" = "passed";

    try {
      // Execute all steps using MCP tool executor
      const results = await this.mcpToolExecutor.executeSteps(
        request.steps,
        this.mcpConnection
      );

      // Determine overall status
      for (const result of results) {
        if (result.status === "failed") {
          overallStatus = "failed";
          break;
        }
      }

      return {
        status: overallStatus,
        steps: results,
        startedAt,
        completedAt: new Date(),
      };
    } catch (error) {
      console.error("[PlaywrightMCP] Execution error:", error);
      return {
        status: "error",
        steps: [],
        startedAt,
        completedAt: new Date(),
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Fallback to direct execution if MCP is not available
   */
  private async executeFallback(
    request: MCPExecutionRequest
  ): Promise<MCPExecutionResponse> {
    const result = await this.fallbackExecutor.execute({
      steps: request.steps,
      options: request.options,
    });

    return {
      id: this.generateExecutionId(),
      status: result.status,
      steps: result.steps,
      totalDuration: 0,
      client: "playwright",
      startedAt: result.startedAt,
      completedAt: result.completedAt,
    };
  }

  /**
   * Get MCP capabilities
   */
  getCapabilities(): string[] {
    return this.config.metadata?.capabilities || [];
  }
}
