/**
 * Groq LLM Provider
 * Fast cloud inference with free tier
 * 
 * Single Responsibility: Only handles Groq API communication
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
// Groq API Types
// ============================================

interface GroqChatRequest {
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
}

interface GroqChatResponse {
  id: string;
  model: string;
  choices: {
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================
// Available Models
// ============================================

export const GROQ_MODELS = {
  'llama-3.3-70b-versatile': {
    name: 'Llama 3.3 70B Versatile',
    contextWindow: 128000,
  },
  'llama-3.1-8b-instant': {
    name: 'Llama 3.1 8B Instant',
    contextWindow: 128000,
  },
  'mixtral-8x7b-32768': {
    name: 'Mixtral 8x7B',
    contextWindow: 32768,
  },
  'gemma2-9b-it': {
    name: 'Gemma 2 9B',
    contextWindow: 8192,
  },
} as const;

export type GroqModelId = keyof typeof GROQ_MODELS;

// ============================================
// Provider Implementation
// ============================================

export class GroqProvider extends BaseLLMProvider {
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  constructor(overrides?: Partial<LLMProviderConfig> & { apiKey?: string }) {
    const apiKey = overrides?.apiKey || config.llm.groq.apiKey || '';
    
    const defaultConfig: LLMProviderConfig = {
      type: 'groq',
      name: 'Groq Cloud',
      model: config.llm.groq.defaultModel,
      apiKey: apiKey,
      isAvailable: !!apiKey,
      isFree: true,
      rateLimit: {
        requestsPerMinute: 30,
        tokensPerMinute: 6000,
      },
    };

    super({ ...defaultConfig, ...overrides });
    this.apiKey = apiKey;

    if (!this.apiKey) {
      console.warn('[GroqProvider] API key not configured. Set GROQ_API_KEY environment variable.');
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async chat(
    messages: ChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    if (!this.apiKey) {
      throw new Error('Groq API key not configured');
    }

    const timeout = options?.timeout || config.llm.groq.timeout;
    const { controller, clear } = this.createTimeoutController(timeout);

    const { result, latencyMs } = await this.measureLatency(async () => {
      try {
        const request: GroqChatRequest = {
          model: this.config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.maxTokens ?? 2048,
          top_p: options?.topP,
          stream: false,
        };

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Groq API error: ${response.status} - ${JSON.stringify(errorData)}`);
        }

        return (await response.json()) as GroqChatResponse;
      } finally {
        clear();
      }
    });

    const choice = result.choices[0];

    return {
      content: choice.message.content,
      model: result.model,
      provider: 'groq',
      usage: {
        promptTokens: result.usage.prompt_tokens,
        completionTokens: result.usage.completion_tokens,
        totalTokens: result.usage.total_tokens,
      },
      finishReason: choice.finish_reason,
      latencyMs,
    };
  }

  /**
   * Get available Groq models
   */
  static getAvailableModels(): typeof GROQ_MODELS {
    return GROQ_MODELS;
  }
}
