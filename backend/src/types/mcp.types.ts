/**
 * MCP (Model Context Protocol) Types
 * For test execution via MCP clients
 */

import { TestStep, TestStepResult } from './test.types.js';

// ============================================
// MCP Client Types
// ============================================

export type MCPClientType = 'playwright' | 'appium' | 'api' | 'custom';

export interface MCPClientConfig {
  type: MCPClientType;
  name: string;
  endpoint?: string;        // MCP server endpoint
  transport?: 'stdio' | 'http' | 'websocket';
  isAvailable: boolean;
  metadata?: {
    capabilities?: string[];
    version?: string;
  };
}

// ============================================
// MCP Client Status
// ============================================

export interface MCPClientStatus {
  type: MCPClientType;
  name: string;
  isAvailable: boolean;
  isConnected: boolean;
  lastChecked?: Date;
  error?: string;
}

// ============================================
// MCP Execution Request/Response
// ============================================

export interface MCPExecutionRequest {
  steps: TestStep[];
  options?: {
    headless?: boolean;
    timeout?: number;
    screenshot?: boolean;
    baseUrl?: string;
  };
}

export interface MCPExecutionResponse {
  id: string;
  status: 'passed' | 'failed' | 'error';
  steps: TestStepResult[];
  totalDuration: number;
  client: MCPClientType;
  startedAt: Date;
  completedAt: Date;
}

// ============================================
// MCP Client Interface
// ============================================

export interface IMCPClient {
  readonly config: MCPClientConfig;
  
  /**
   * Connect to MCP server
   */
  connect(): Promise<boolean>;
  
  /**
   * Disconnect from MCP server
   */
  disconnect(): Promise<void>;
  
  /**
   * Check if client is connected
   */
  isConnected(): boolean;
  
  /**
   * Execute test steps via MCP
   */
  executeSteps(request: MCPExecutionRequest): Promise<MCPExecutionResponse>;
  
  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;
}
