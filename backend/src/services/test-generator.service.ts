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
} from '../types/index.js';
import { LLMManager } from '../llm/llm-manager.js';

export class TestGeneratorService {
  constructor(private readonly llmManager: LLMManager) {}

  /**
   * Generate test steps from natural language scenario
   */
  async generateSteps(request: TestGenerationRequest): Promise<TestGenerationResponse> {
    const provider = this.llmManager.getActiveProvider();
    
    if (!provider) {
      throw new Error('No active LLM provider available');
    }

    const systemPrompt = this.buildSystemPrompt(request.context);
    const options: LLMRequestOptions = {
      temperature: 0.3,  // Lower temperature for more deterministic output
      maxTokens: 2048,
      timeout: 120000,   // 2 min timeout for local LLMs
    };

    const response = await provider.generate(request.scenario, systemPrompt, options);
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
   * Build system prompt for test generation
   */
  private buildSystemPrompt(context?: TestGenerationRequest['context']): string {
    const basePrompt = `You are an expert QA automation engineer.
Convert the given test scenario into structured JSON test steps.

STRICT RULES:
1. Return ONLY a valid JSON array - no explanations, no markdown
2. Use these standard actions: goto, fill, click, hover, select, check, expectVisible, expectText, expectUrl, wait
3. Each step must have: action (required), target (selector/url), value (for inputs), description (human readable)
4. Use semantic selectors: #id, .class, [role="button"], [aria-label="..."], button[type="submit"]`;

    const contextParts: string[] = [];
    
    if (context?.allowedActions?.length) {
      contextParts.push(`ALLOWED ACTIONS: ${context.allowedActions.join(', ')}`);
    }
    
    if (context?.allowedElements?.length) {
      contextParts.push(`KNOWN ELEMENTS: ${context.allowedElements.join(', ')}`);
    }
    
    if (context?.pageType) {
      contextParts.push(`PAGE TYPE: ${context.pageType}`);
    }
    
    if (context?.baseUrl) {
      contextParts.push(`BASE URL: ${context.baseUrl}`);
    }
    
    if (context?.customInstructions) {
      contextParts.push(`ADDITIONAL INSTRUCTIONS: ${context.customInstructions}`);
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
      parts.push('\n' + contextParts.join('\n'));
    }
    
    parts.push(example);
    parts.push('\nNow convert the following test scenario to JSON steps:');

    return parts.join('\n');
  }

  /**
   * Parse test steps from LLM response
   */
  private parseSteps(content: string): TestStep[] {
    // Clean markdown code blocks
    let cleaned = content
      .replace(/```json\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    // Extract JSON array
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error(`Invalid response format: Could not find JSON array in response`);
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      // Validate and normalize steps
      return parsed.map((step: Record<string, unknown>, index: number) => {
        if (!step.action || typeof step.action !== 'string') {
          throw new Error(`Step ${index + 1}: Missing or invalid 'action' field`);
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
        
        if (step.timeout && typeof step.timeout === 'number') {
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

export function createTestGeneratorService(llmManager: LLMManager): TestGeneratorService {
  return new TestGeneratorService(llmManager);
}
