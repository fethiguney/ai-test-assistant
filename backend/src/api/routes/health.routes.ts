/**
 * Health Routes
 * System health and status endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { llmManager } from '../../llm/index.js';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/status
 * Detailed system status
 */
router.get('/api/status', asyncHandler(async (_req: Request, res: Response) => {
  const providerStatuses = await llmManager.checkAllProviders();
  const summary = llmManager.getSummary();

  res.json({
    status: 'ok',
    activeProvider: summary.activeProvider,
    providers: providerStatuses,
    timestamp: new Date().toISOString(),
  });
}));

export { router as healthRoutes };
