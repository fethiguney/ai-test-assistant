/**
 * Base LLM Provider
 * Abstract class with common functionality
 * Follows Template Method pattern
 */

import {
  ILLMProvider,
  LLMProviderConfig,
  ChatMessage,
  LLMRequestOptions,
  LLMResponse,
} from '../../types/index.js';

export abstract class BaseLLMProvider implements ILLMProvider {
  constructor(public readonly config: LLMProviderConfig) {}

  /**
   * Health check - must be implemented by each provider
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Chat completion - must be implemented by each provider
   */
  abstract chat(
    messages: ChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;

  /**
   * Simple generation - convenience wrapper around chat
   * Can be overridden by providers with native generate API
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const messages: ChatMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    return this.chat(messages, options);
  }

  /**
   * Measure execution time - utility for all providers
   */
  protected async measureLatency<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; latencyMs: number }> {
    const start = performance.now();
    const result = await fn();
    const latencyMs = Math.round(performance.now() - start);
    return { result, latencyMs };
  }

  /**
   * Create abort controller with timeout
   */
  protected createTimeoutController(timeoutMs: number): {
    controller: AbortController;
    clear: () => void;
  } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    return {
      controller,
      clear: () => clearTimeout(timeoutId),
    };
  }
}
