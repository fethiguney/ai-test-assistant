/**
 * Ollama LLM Provider
 * Local LLM support via Ollama
 * 
 * Single Responsibility: Only handles Ollama API communication
 */

import { BaseLLMProvider } from './base.provider.js';
import {
  LLMProviderConfig,
  ChatMessage,
  LLMRequestOptions,
  LLMResponse,
} from '../../types/index.js';
import { config } from '../../config/index.js';

// ============================================
// Ollama API Types
// ============================================

interface OllamaChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
    top_p?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaTagsResponse {
  models: { name: string }[];
}

// ============================================
// Provider Implementation
// ============================================

export class OllamaProvider extends BaseLLMProvider {
  private readonly baseUrl: string;

  constructor(overrides?: Partial<LLMProviderConfig>) {
    const defaultConfig: LLMProviderConfig = {
      type: 'ollama',
      name: 'Ollama (Local)',
      model: config.llm.ollama.defaultModel,
      baseUrl: config.llm.ollama.baseUrl,
      isAvailable: true,
      isFree: true,
    };

    super({ ...defaultConfig, ...overrides });
    this.baseUrl = this.config.baseUrl || config.llm.ollama.baseUrl;
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as OllamaTagsResponse;
      const models = data.models || [];
      const modelPrefix = this.config.model.split(':')[0];
      
      return models.some((m) => m.name.includes(modelPrefix));
    } catch {
      return false;
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const timeout = options?.timeout || config.llm.ollama.timeout;
    const { controller, clear } = this.createTimeoutController(timeout);

    const { result, latencyMs } = await this.measureLatency(async () => {
      try {
        const request: OllamaChatRequest = {
          model: this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 2048,
            top_p: options?.topP,
          },
        };

        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
        }

        return (await response.json()) as OllamaChatResponse;
      } finally {
        clear();
      }
    });

    return {
      content: result.message.content,
      model: result.model,
      provider: 'ollama',
      usage: {
        promptTokens: result.prompt_eval_count || 0,
        completionTokens: result.eval_count || 0,
        totalTokens: (result.prompt_eval_count || 0) + (result.eval_count || 0),
      },
      latencyMs,
    };
  }

  /**
   * List available models on Ollama server
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      const data = (await response.json()) as OllamaTagsResponse;
      return (data.models || []).map((m) => m.name);
    } catch {
      return [];
    }
  }
}
