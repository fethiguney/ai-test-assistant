/**
 * LLM Manager
 * 
 * Single Responsibility: Provider lifecycle management
 * - Register/unregister providers
 * - Health checks
 * - Provider selection
 * 
 * Does NOT handle: Test generation (moved to TestGeneratorService)
 */

import {
  ILLMProvider,
  LLMProviderType,
  ChatMessage,
  LLMRequestOptions,
  LLMResponse,
  ProviderStatus,
} from '../types/index.js';
import { OllamaProvider, GroqProvider } from './providers/index.js';

export class LLMManager {
  private providers: Map<LLMProviderType, ILLMProvider> = new Map();
  private activeProviderType: LLMProviderType | null = null;

  constructor() {
    // Don't auto-initialize - let caller decide
  }

  /**
   * Initialize default providers
   * Separated from constructor for better testability
   */
  initializeDefaultProviders(): void {
    this.registerProvider(new OllamaProvider());
    this.registerProvider(new GroqProvider());
    
    // Set default active provider
    this.activeProviderType = 'ollama';
    
    console.log('[LLMManager] Initialized with providers:', this.getProviderTypes());
  }

  // ============================================
  // Provider Registration (Open/Closed Principle)
  // ============================================

  registerProvider(provider: ILLMProvider): void {
    this.providers.set(provider.config.type, provider);
  }

  unregisterProvider(type: LLMProviderType): boolean {
    return this.providers.delete(type);
  }

  // ============================================
  // Provider Access
  // ============================================

  getProvider(type: LLMProviderType): ILLMProvider | undefined {
    return this.providers.get(type);
  }

  getActiveProvider(): ILLMProvider | null {
    if (!this.activeProviderType) return null;
    return this.providers.get(this.activeProviderType) || null;
  }

  getProviderTypes(): LLMProviderType[] {
    return Array.from(this.providers.keys());
  }

  // ============================================
  // Provider Selection
  // ============================================

  setActiveProvider(type: LLMProviderType): boolean {
    if (!this.providers.has(type)) {
      console.error(`[LLMManager] Provider ${type} not registered`);
      return false;
    }
    
    this.activeProviderType = type;
    console.log(`[LLMManager] Active provider: ${type}`);
    return true;
  }

  getActiveProviderType(): LLMProviderType | null {
    return this.activeProviderType;
  }

  // ============================================
  // Health Checks
  // ============================================

  async checkProviderHealth(type: LLMProviderType): Promise<ProviderStatus> {
    const provider = this.providers.get(type);
    
    if (!provider) {
      return {
        type,
        name: 'Unknown',
        model: 'Unknown',
        isAvailable: false,
        isFree: false,
        error: 'Provider not registered',
      };
    }

    try {
      const isAvailable = await provider.healthCheck();
      return {
        type,
        name: provider.config.name,
        model: provider.config.model,
        isAvailable,
        isFree: provider.config.isFree,
        lastChecked: new Date(),
      };
    } catch (error) {
      return {
        type,
        name: provider.config.name,
        model: provider.config.model,
        isAvailable: false,
        isFree: provider.config.isFree,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkAllProviders(): Promise<ProviderStatus[]> {
    const checks = Array.from(this.providers.keys()).map(
      (type) => this.checkProviderHealth(type)
    );
    return Promise.all(checks);
  }

  async findFirstAvailableProvider(preferFree = true): Promise<LLMProviderType | null> {
    const statuses = await this.checkAllProviders();
    
    const sorted = [...statuses].sort((a, b) => {
      if (preferFree && a.isFree !== b.isFree) {
        return a.isFree ? -1 : 1;
      }
      return 0;
    });

    const available = sorted.find((s) => s.isAvailable);
    return available?.type || null;
  }

  // ============================================
  // LLM Operations (Delegated to active provider)
  // ============================================

  async chat(
    messages: ChatMessage[],
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active LLM provider configured');
    }
    return provider.chat(messages, options);
  }

  async generate(
    prompt: string,
    systemPrompt?: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const provider = this.getActiveProvider();
    if (!provider) {
      throw new Error('No active LLM provider configured');
    }
    return provider.generate(prompt, systemPrompt, options);
  }

  // ============================================
  // Summary
  // ============================================

  getSummary(): {
    activeProvider: LLMProviderType | null;
    providers: {
      type: LLMProviderType;
      name: string;
      model: string;
      isFree: boolean;
    }[];
  } {
    const providers = Array.from(this.providers.entries()).map(([type, p]) => ({
      type,
      name: p.config.name,
      model: p.config.model,
      isFree: p.config.isFree,
    }));

    return {
      activeProvider: this.activeProviderType,
      providers,
    };
  }
}

// ============================================
// Singleton Instance
// ============================================

export const llmManager = new LLMManager();

// Initialize on module load
llmManager.initializeDefaultProviders();
