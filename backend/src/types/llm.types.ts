/**
 * LLM Provider Types & Interfaces
 * Pure type definitions - no implementation logic
 */

// ============================================
// Provider Types
// ============================================

export type LLMProviderType = 'ollama' | 'groq' | 'openai' | 'anthropic' | 'google';

// ============================================
// Message Types
// ============================================

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ============================================
// Request/Response Types
// ============================================

export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  timeout?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: LLMProviderType;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
  latencyMs: number;
}

// ============================================
// Provider Configuration
// ============================================

export interface LLMProviderConfig {
  type: LLMProviderType;
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  isAvailable: boolean;
  isFree: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute?: number;
  };
}

// ============================================
// Provider Status
// ============================================

export interface ProviderStatus {
  type: LLMProviderType;
  name: string;
  model: string;
  isAvailable: boolean;
  isFree: boolean;
  lastChecked?: Date;
  error?: string;
}

// ============================================
// Provider Interface (Contract)
// ============================================

export interface ILLMProvider {
  readonly config: LLMProviderConfig;
  
  healthCheck(): Promise<boolean>;
  
  chat(
    messages: ChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;
  
  generate(
    prompt: string,
    systemPrompt?: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse>;
}
