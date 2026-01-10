/**
 * Base MCP Client
 * Abstract class for MCP client implementations
 * 
 * Single Responsibility: Common MCP client functionality
 */

import {
  IMCPClient,
  MCPClientConfig,
  MCPExecutionRequest,
  MCPExecutionResponse,
} from '../../types/index.js';

export abstract class BaseMCPClient implements IMCPClient {
  protected connected: boolean = false;

  constructor(public readonly config: MCPClientConfig) {}

  /**
   * Connect to MCP server - must be implemented
   */
  abstract connect(): Promise<boolean>;

  /**
   * Disconnect from MCP server - must be implemented
   */
  abstract disconnect(): Promise<void>;

  /**
   * Execute steps via MCP - must be implemented
   */
  abstract executeSteps(request: MCPExecutionRequest): Promise<MCPExecutionResponse>;

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.connected) {
        return await this.connect();
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Generate execution ID
   */
  protected generateExecutionId(): string {
    return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Measure execution time
   */
  protected async measureExecution<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration };
  }
}
