/**
 * LLM Routes
 * Provider management and generation endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, validators, LLMError } from '../middleware/index.js';
import { llmManager } from '../../llm/index.js';
import { LLMProviderType, ChatMessage, LLMRequestOptions } from '../../types/index.js';

const router = Router();

// ============================================
// Provider Management
// ============================================

/**
 * GET /api/llm/providers
 * List all registered providers
 */
router.get('/providers', (_req: Request, res: Response) => {
  const summary = llmManager.getSummary();
  res.json(summary);
});

/**
 * GET /api/llm/providers/health
 * Check health of all providers
 */
router.get('/providers/health', asyncHandler(async (_req: Request, res: Response) => {
  const statuses = await llmManager.checkAllProviders();
  res.json({ providers: statuses });
}));

/**
 * POST /api/llm/providers/active
 * Set the active provider
 */
router.post(
  '/providers/active',
  validators.setActiveProvider,
  (req: Request, res: Response) => {
    const { provider } = req.body as { provider: LLMProviderType };
    
    const success = llmManager.setActiveProvider(provider);
    
    if (success) {
      res.json({
        message: `Active provider set to ${provider}`,
        activeProvider: provider,
      });
    } else {
      throw new LLMError(`Provider ${provider} not found or not registered`);
    }
  }
);

// ============================================
// Generation Endpoints
// ============================================

/**
 * POST /api/llm/generate
 * Simple text generation
 */
router.post(
  '/generate',
  validators.generate,
  asyncHandler(async (req: Request, res: Response) => {
    const { prompt, systemPrompt, options } = req.body as {
      prompt: string;
      systemPrompt?: string;
      options?: LLMRequestOptions;
    };

    try {
      const response = await llmManager.generate(prompt, systemPrompt, options);
      res.json(response);
    } catch (error) {
      throw new LLMError(
        error instanceof Error ? error.message : 'Generation failed',
        llmManager.getActiveProviderType() || undefined
      );
    }
  })
);

/**
 * POST /api/llm/chat
 * Chat completion
 */
router.post(
  '/chat',
  validators.chat,
  asyncHandler(async (req: Request, res: Response) => {
    const { messages, options } = req.body as {
      messages: ChatMessage[];
      options?: LLMRequestOptions;
    };

    try {
      const response = await llmManager.chat(messages, options);
      res.json(response);
    } catch (error) {
      throw new LLMError(
        error instanceof Error ? error.message : 'Chat completion failed',
        llmManager.getActiveProviderType() || undefined
      );
    }
  })
);

export { router as llmRoutes };
