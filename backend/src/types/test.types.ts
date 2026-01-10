/**
 * Test-related Types
 * Separated from LLM types for better modularity
 */

import { LLMProviderType } from "./llm.types.js";

// ============================================
// Test Step Types
// ============================================

export type TestStepAction =
  | "goto"
  | "fill"
  | "click"
  | "hover"
  | "select"
  | "check"
  | "uncheck"
  | "expectVisible"
  | "expectHidden"
  | "expectText"
  | "expectUrl"
  | "wait"
  | "screenshot"
  | "scroll";

export interface TestStep {
  action: TestStepAction | string; // string for extensibility
  target?: string;
  value?: string;
  description?: string;
  timeout?: number;
}

// ============================================
// Test Generation Types
// ============================================

export interface TestContext {
  pageType?: string;
  allowedActions?: string[];
  allowedElements?: string[];
  baseUrl?: string;
  customInstructions?: string;
}

export interface TestGenerationRequest {
  scenario: string;
  context?: TestContext;
}

export interface TestGenerationResponse {
  steps: TestStep[];
  rawResponse: string;
  model: string;
  provider: LLMProviderType;
  latencyMs: number;
}

// ============================================
// Test Execution Types
// ============================================

export type TestStepStatus =
  | "pending"
  | "running"
  | "passed"
  | "failed"
  | "skipped";

export interface TestStepResult {
  step: TestStep;
  status: TestStepStatus;
  duration: number;
  error?: string;
  screenshot?: string;
}

export interface TestExecutionResult {
  id: string;
  scenario?: string;
  steps: TestStepResult[];
  status: "passed" | "failed" | "error";
  totalDuration: number;
  startedAt: Date;
  completedAt: Date;
}

export interface TestExecutionRequest {
  steps: TestStep[];
  scenario?: string;
  options?: {
    headless?: boolean;
    baseUrl?: string;
    timeout?: number;
    screenshot?: boolean;
  };
}

// ============================================
// Dynamic Test Run (Unified Flow)
// ============================================

export interface DynamicTestRunRequest {
  prompt: string; // User's natural language prompt
  llmProvider?: LLMProviderType; // Optional: specific LLM to use
  mcpClient?: 'playwright' | 'direct' | 'appium'; // Optional: MCP client or direct
  context?: TestContext; // Optional: test context
  executeImmediately?: boolean; // Run test after generation?
  executionOptions?: {
    headless?: boolean;
    timeout?: number;
    screenshot?: boolean;
  };
}

export interface DynamicTestRunResponse {
  id: string;
  prompt: string;
  generatedSteps: TestStep[];
  llmUsed: {
    provider: LLMProviderType;
    model: string;
    latencyMs: number;
  };
  executionMethod?: 'direct' | 'mcp'; // How was it executed
  mcpClient?: string; // Which MCP client was used
  execution?: TestExecutionResult; // Only if executeImmediately=true
  status: "generated" | "executed";
  timestamp: Date;
}

// ============================================
// Test Scenario Storage Types (for future use)
// ============================================

export interface SavedTestScenario {
  id: string;
  name: string;
  description?: string;
  scenario: string;
  context?: TestContext;
  generatedSteps?: TestStep[];
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
}
