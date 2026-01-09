/**
 * Test-related Types
 * Separated from LLM types for better modularity
 */

import { LLMProviderType } from './llm.types.js';

// ============================================
// Test Step Types
// ============================================

export type TestStepAction = 
  | 'goto'
  | 'fill'
  | 'click'
  | 'hover'
  | 'select'
  | 'check'
  | 'uncheck'
  | 'expectVisible'
  | 'expectHidden'
  | 'expectText'
  | 'expectUrl'
  | 'wait'
  | 'screenshot'
  | 'scroll';

export interface TestStep {
  action: TestStepAction | string;  // string for extensibility
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

export type TestStepStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

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
  status: 'passed' | 'failed' | 'error';
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
