/**
 * Validation Middleware
 * Request validation using Zod schemas
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from './error-handler.js';

// ============================================
// Validation Schemas
// ============================================

export const schemas = {
  // Provider selection
  setActiveProvider: z.object({
    provider: z.enum(['ollama', 'groq', 'openai', 'anthropic', 'google']),
  }),

  // Simple generation
  generate: z.object({
    prompt: z.string().min(1, 'Prompt is required'),
    systemPrompt: z.string().optional(),
    options: z.object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
      timeout: z.number().positive().optional(),
    }).optional(),
  }),

  // Chat completion
  chat: z.object({
    messages: z.array(z.object({
      role: z.enum(['system', 'user', 'assistant']),
      content: z.string(),
    })).min(1, 'At least one message is required'),
    options: z.object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
      topP: z.number().min(0).max(1).optional(),
      timeout: z.number().positive().optional(),
    }).optional(),
  }),

  // Test step generation
  generateTestSteps: z.object({
    scenario: z.string().min(1, 'Test scenario is required'),
    context: z.object({
      pageType: z.string().optional(),
      allowedActions: z.array(z.string()).optional(),
      allowedElements: z.array(z.string()).optional(),
      baseUrl: z.string().url().optional(),
      customInstructions: z.string().optional(),
    }).optional(),
  }),

  // Test step execution
  executeTestSteps: z.object({
    steps: z.array(z.object({
      action: z.string(),
      target: z.string().optional(),
      value: z.string().optional(),
      description: z.string().optional(),
      timeout: z.number().positive().optional(),
    })).min(1, 'At least one step is required'),
    scenario: z.string().optional(),
    options: z.object({
      headless: z.boolean().optional(),
      baseUrl: z.string().url().optional(),
      timeout: z.number().positive().optional(),
      screenshot: z.boolean().optional(),
    }).optional(),
  }),
};

// ============================================
// Validation Middleware Factory
// ============================================

type ValidationType = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, type: ValidationType = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = type === 'body' ? req.body : type === 'query' ? req.query : req.params;
      const validated = schema.parse(data);
      
      // Replace with validated data
      if (type === 'body') {
        req.body = validated;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        
        next(new ValidationError('Validation failed', details));
      } else {
        next(error);
      }
    }
  };
}

// ============================================
// Pre-built Validators
// ============================================

export const validators = {
  setActiveProvider: validate(schemas.setActiveProvider),
  generate: validate(schemas.generate),
  chat: validate(schemas.chat),
  generateTestSteps: validate(schemas.generateTestSteps),
  executeTestSteps: validate(schemas.executeTestSteps),
};
