/**
 * Test Orchestrator Service
 * 
 * Single Responsibility: Orchestrate dynamic test flow
 * - Convert prompt → steps (via LLM)
 * - Optionally execute steps (direct or via MCP)
 * - Manage LLM & MCP client selection
 */

import { LLMManager } from '../llm/llm-manager.js';
import { MCPManager } from '../mcp/mcp-manager.js';
import { TestGeneratorService } from './test-generator.service.js';
import { StepExecutorService } from './step-executor.service.js';
import {
  DynamicTestRunRequest,
  DynamicTestRunResponse,
  TestStep,
} from '../types/index.js';

export class TestOrchestratorService {
  private generator: TestGeneratorService;
  private directExecutor: StepExecutorService;

  constructor(
    private readonly llmManager: LLMManager,
    private readonly mcpManager: MCPManager
  ) {
    this.generator = new TestGeneratorService(llmManager);
    this.directExecutor = new StepExecutorService();
  }

  /**
   * Run dynamic test from user prompt
   * - Switches LLM provider if specified
   * - Generates test steps
   * - Optionally executes steps
   */
  async runDynamicTest(request: DynamicTestRunRequest): Promise<DynamicTestRunResponse> {
    const startTime = Date.now();
    const runId = this.generateRunId();

    // 1. Switch LLM provider if specified
    if (request.llmProvider) {
      const switched = this.llmManager.setActiveProvider(request.llmProvider);
      if (!switched) {
        throw new Error(`Failed to switch to LLM provider: ${request.llmProvider}`);
      }
    }

    const activeProvider = this.llmManager.getActiveProvider();
    if (!activeProvider) {
      throw new Error('No active LLM provider available');
    }

    console.log(`[Orchestrator] Running test with ${activeProvider.config.name}`);

    // 2. Generate test steps from prompt
    const generationResult = await this.generator.generateSteps({
      scenario: request.prompt,
      context: request.context,
    });

    const response: DynamicTestRunResponse = {
      id: runId,
      prompt: request.prompt,
      generatedSteps: generationResult.steps,
      llmUsed: {
        provider: generationResult.provider,
        model: generationResult.model,
        latencyMs: generationResult.latencyMs,
      },
      status: 'generated',
      timestamp: new Date(),
    };

    // 3. Execute immediately if requested
    if (request.executeImmediately) {
      console.log(`[Orchestrator] Executing ${generationResult.steps.length} steps`);
      
      // Determine execution method: MCP or direct
      const useMCP = request.mcpClient && request.mcpClient !== 'direct';
      
      if (useMCP) {
        // Execute via MCP
        console.log(`[Orchestrator] Using MCP client: ${request.mcpClient}`);
        
        if (request.mcpClient !== 'direct') {
          this.mcpManager.setActiveClient(request.mcpClient as any);
        }
        
        const mcpResult = await this.mcpManager.executeSteps({
          steps: generationResult.steps,
          options: request.executionOptions,
        });
        
        response.execution = {
          id: mcpResult.id,
          scenario: request.prompt,
          steps: mcpResult.steps,
          status: mcpResult.status,
          totalDuration: mcpResult.totalDuration,
          startedAt: mcpResult.startedAt,
          completedAt: mcpResult.completedAt,
        };
        response.executionMethod = 'mcp';
        response.mcpClient = request.mcpClient;
      } else {
        // Direct execution
        console.log('[Orchestrator] Using direct Playwright execution');
        
        const executionResult = await this.directExecutor.execute({
          steps: generationResult.steps,
          scenario: request.prompt,
          options: request.executionOptions,
        });

        response.execution = executionResult;
        response.executionMethod = 'direct';
      }
      
      response.status = 'executed';
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Orchestrator] Test run ${runId} completed in ${totalTime}ms - Status: ${response.status}`);

    return response;
  }

  /**
   * Get available LLM providers
   */
  getAvailableProviders() {
    return this.llmManager.getSummary();
  }

  /**
   * Switch active LLM provider
   */
  switchProvider(provider: string): boolean {
    return this.llmManager.setActiveProvider(provider as any);
  }

  /**
   * Get MCP client summary
   */
  getMCPClients() {
    return this.mcpManager.getSummary();
  }

  /**
   * Switch MCP client
   */
  switchMCPClient(client: string): boolean {
    return this.mcpManager.setActiveClient(client as any);
  }

  private generateRunId(): string {
    return `run_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// Factory
export function createTestOrchestratorService(
  llmManager: LLMManager,
  mcpManager: MCPManager
): TestOrchestratorService {
  return new TestOrchestratorService(llmManager, mcpManager);
}
