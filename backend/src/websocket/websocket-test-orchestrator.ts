/**
 * WebSocket Test Orchestrator - Simplified orchestrator for WebSocket sessions
 */
import { llmManager } from '../llm/index.js';
import { TestGeneratorService } from '../services/test-generator.service.js';
import { StepExecutorService } from '../services/step-executor.service.js';
import { mcpManager } from '../mcp/index.js';
import { TestStep, TestStepResult, DynamicTestRunRequest, DynamicTestRunResponse } from '../types/index.js';

class WebSocketTestOrchestrator {
  private testGenerator: TestGeneratorService;
  private stepExecutor: StepExecutorService;

  constructor() {
    this.testGenerator = new TestGeneratorService(llmManager);
    this.stepExecutor = new StepExecutorService();
  }

  /**
   * Generate test steps from a scenario
   */
  async generateSteps(scenario: string, llmProvider?: string): Promise<TestStep[]> {
    // Set active provider if specified
    if (llmProvider) {
      llmManager.setActiveProvider(llmProvider as any);
    }
    
    const response = await this.testGenerator.generateSteps({ scenario });
    return response.steps;
  }

  /**
   * Execute a single step
   */
  async executeStep(step: TestStep, mcpClient?: string): Promise<TestStepResult> {
    if (mcpClient) {
      // Use MCP client
      const client = mcpManager.getClient(mcpClient as any);
      if (!client) {
        throw new Error(`MCP client not found: ${mcpClient}`);
      }

      const response = await client.executeSteps({ steps: [step] });
      if (!response.steps || response.steps.length === 0) {
        throw new Error('No results returned from MCP client');
      }
      return response.steps[0];
    } else {
      // Use direct Playwright execution
      const result = await this.stepExecutor.execute({ steps: [step] });
      if (!result.steps || result.steps.length === 0) {
        throw new Error('No results returned from step executor');
      }
      return result.steps[0];
    }
  }

  /**
   * Run full test (generation + execution)
   */
  async runTest(scenario: string, llmProvider?: string, executeImmediately?: boolean, mcpClient?: string): Promise<any> {
    const steps = await this.generateSteps(scenario, llmProvider);

    const activeProvider = llmManager.getActiveProvider();
    const providerName = activeProvider ? (activeProvider as any).name || 'unknown' : 'unknown';

    if (!executeImmediately) {
      return {
        sessionId: `session_${Date.now()}`,
        generatedSteps: steps,
        llmProvider: llmProvider || providerName,
      };
    }

    // Execute all steps
    let executionResult;
    if (mcpClient) {
      const client = mcpManager.getClient(mcpClient as any);
      if (!client) {
        throw new Error(`MCP client not found: ${mcpClient}`);
      }
      executionResult = await client.executeSteps({ steps });
    } else {
      executionResult = await this.stepExecutor.execute({ steps });
    }

    return {
      sessionId: `session_${Date.now()}`,
      generatedSteps: steps,
      executionResult,
      llmProvider: llmProvider || providerName,
      mcpClient,
    };
  }
}

export const testOrchestrator = new WebSocketTestOrchestrator();
