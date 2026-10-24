import type { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Creates an in-memory sliding rate limiter middleware.
 * Fully typed, zero external dependencies, robust and safe.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please slow down.',
    keyGenerator,
  } = options;

  const clients = new Map<string, ClientRecord>();

  // Periodically clean up expired records to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of clients.entries()) {
      if (now > record.resetTime) {
        clients.delete(key);
      }
    }
  }, Math.max(windowMs, 30_000));

  // Allow node process to exit cleanly without keeping interval alive
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // In test environment, bypass rate limiter unless explicitly enabled
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const clientKey = keyGenerator
      ? keyGenerator(req)
      : (req.user ? `user:${req.user.id}` : req.ip) || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    let record = clients.get(clientKey);

    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + windowMs,
      };
      clients.set(clientKey, record);
    } else {
      record.count += 1;
    }

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.setHeader('Retry-After', resetSeconds);
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message,
          details: { retryAfterSeconds: resetSeconds },
        },
      });
      return;
    }

    next();
  };
}

/** Rate limiter for expensive AI generation and chat endpoints */
export const aiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 AI requests per minute
  message: 'AI generation rate limit exceeded. Please wait a moment before sending more requests.',
});

/** General API rate limiter to protect against DoS */
export const generalRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120, // 120 requests per minute
  message: 'Request limit exceeded. Please try again in a minute.',
});

/** Rate limiter for authentication endpoints to protect against brute-force attacks */
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

/** Stricter rate limiter for unauthenticated guest AI plan generation to prevent abuse */
export const guestAiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 guest plans per 15 minutes per IP
  message: 'Guest celebration plan generation limit reached. Please wait a few minutes or log in to continue.',
});

