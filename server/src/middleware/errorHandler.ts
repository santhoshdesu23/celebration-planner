import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiErrorSchema } from '@celebration-planner/shared';
import { z } from 'zod';

import { formatSafeError } from '../config/env.js';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

type ApiErrorResponse = z.infer<typeof ApiErrorSchema>;

function isZodError(error: unknown): error is ZodError {
  return (
    error instanceof ZodError ||
    (typeof error === 'object' && error !== null && 'name' in error && (error as { name: unknown }).name === 'ZodError')
  );
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(body);
    return;
  }

  if (isZodError(err)) {
    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: typeof err.flatten === 'function' ? err.flatten() : err,
      },
    };
    res.status(400).json(body);
    return;
  }

  // Database connectivity failures: report "unavailable" (retryable) rather than a generic 500.
  const errName = err instanceof Error ? err.name : '';
  if (
    [
      'MongoNetworkError',
      'MongoNetworkTimeoutError',
      'MongoServerSelectionError',
      'MongooseServerSelectionError',
    ].includes(errName) ||
    (err instanceof Error && /buffering timed out/i.test(err.message))
  ) {
    console.error('Storage unavailable:', formatSafeError(err));
    res.setHeader('Retry-After', 5);
    res.status(503).json({
      success: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Persistent storage is temporarily unavailable. Please try again shortly.',
      },
    });
    return;
  }

  // Unknown error — log safe message without leaking credentials or stacks
  console.error('Unhandled error:', formatSafeError(err));
  const body: ApiErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
    },
  };
  res.status(500).json(body);
}
