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
