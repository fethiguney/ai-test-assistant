/**
 * Error Handler Middleware
 * Centralized error handling for Express
 */

import { Request, Response, NextFunction } from 'express';

// ============================================
// Custom Error Classes
// ============================================

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public readonly details?: unknown) {
    super(400, message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} not found`, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

export class LLMError extends AppError {
  constructor(message: string, public readonly provider?: string) {
    super(503, message, 'LLM_ERROR');
    this.name = 'LLMError';
  }
}

// ============================================
// Error Response Interface
// ============================================

interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    details?: unknown;
    stack?: string;
  };
  timestamp: string;
  path: string;
}

// ============================================
// Error Handler Middleware
// ============================================

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isDev = process.env.NODE_ENV !== 'production';

  // Default error values
  let statusCode = 500;
  let message = 'Internal Server Error';
  let code = 'INTERNAL_ERROR';
  let details: unknown = undefined;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
    code = err.code || 'APP_ERROR';
    
    if (err instanceof ValidationError) {
      details = err.details;
    }
  } else if (err.name === 'SyntaxError' && 'body' in err) {
    // JSON parsing error
    statusCode = 400;
    message = 'Invalid JSON in request body';
    code = 'INVALID_JSON';
  }

  // Log error
  console.error(`[Error] ${req.method} ${req.path}:`, {
    message: err.message,
    code,
    stack: isDev ? err.stack : undefined,
  });

  // Build response
  const response: ErrorResponse = {
    error: {
      message,
      code,
      details,
      stack: isDev ? err.stack : undefined,
    },
    timestamp: new Date().toISOString(),
    path: req.path,
  };

  res.status(statusCode).json(response);
}

// ============================================
// Async Handler Wrapper
// ============================================

type AsyncHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

export function asyncHandler(fn: AsyncHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
