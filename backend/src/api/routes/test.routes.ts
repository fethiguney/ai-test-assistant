/**
 * Test Routes
 * Test generation and execution endpoints
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, validators, LLMError } from '../middleware/index.js';
import { llmManager } from '../../llm/index.js';
import { 
  createTestGeneratorService, 
  createStepExecutorService 
} from '../../services/index.js';
import { 
  TestGenerationRequest, 
  TestExecutionRequest 
} from '../../types/index.js';

const router = Router();

// Create services with DI
const testGenerator = createTestGeneratorService(llmManager);
const stepExecutor = createStepExecutorService();

/**
 * POST /api/test/generate-steps
 * Generate test steps from natural language scenario
 */
router.post(
  '/generate-steps',
  validators.generateTestSteps,
  asyncHandler(async (req: Request, res: Response) => {
    const request = req.body as TestGenerationRequest;

    console.log('[TestRoutes] Generating steps for scenario:', 
      request.scenario.substring(0, 100) + '...'
    );

    try {
      const result = await testGenerator.generateSteps(request);
      
      console.log(`[TestRoutes] Generated ${result.steps.length} steps in ${result.latencyMs}ms`);
      
      res.json(result);
    } catch (error) {
      throw new LLMError(
        error instanceof Error ? error.message : 'Test generation failed',
        llmManager.getActiveProviderType() || undefined
      );
    }
  })
);

/**
 * POST /api/test/execute-steps
 * Execute test steps with Playwright
 */
router.post(
  '/execute-steps',
  validators.executeTestSteps,
  asyncHandler(async (req: Request, res: Response) => {
    const request = req.body as TestExecutionRequest;

    console.log('[TestRoutes] Executing', request.steps.length, 'steps');

    try {
      const result = await stepExecutor.execute(request);
      
      console.log(`[TestRoutes] Execution ${result.status} in ${result.totalDuration}ms`);
      
      res.json(result);
    } catch (error) {
      throw new LLMError(
        error instanceof Error ? error.message : 'Test execution failed'
      );
    }
  })
);

/**
 * POST /api/test/validate-steps
 * Validate test steps format
 */
router.post('/validate-steps', asyncHandler(async (req: Request, res: Response) => {
  const { steps } = req.body;
  
  if (!Array.isArray(steps)) {
    res.status(400).json({ valid: false, error: 'Steps must be an array' });
    return;
  }

  const errors: string[] = [];
  
  steps.forEach((step, index) => {
    if (!step.action) {
      errors.push(`Step ${index + 1}: Missing 'action' field`);
    }
  });

  res.json({
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
    stepCount: steps.length,
  });
}));

export { router as testRoutes };
