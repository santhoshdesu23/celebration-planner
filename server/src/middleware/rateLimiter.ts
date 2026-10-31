import type { Request, Response, NextFunction } from 'express';
import { isDbConnected } from '../db/connection.js';
import { formatSafeError } from '../config/env.js';
import { mongoRateLimitStore, type SharedRateLimitStore } from '../services/rateLimitStore.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  /**
   * Identifier for this limiter. Required (with sharedStore) to count across serverless instances.
   */
  name?: string;
  /** Cross-instance counter store (MongoDB). Without it, counters are per instance only. */
  sharedStore?: SharedRateLimitStore;
  /** Whether the shared store is usable right now. Defaults to the MongoDB connection state. */
  useSharedStore?: () => boolean;
}

interface ClientRecord {
  count: number;
  resetTime: number;
}

/**
 * Creates a fixed-window rate limiter middleware.
 * Counters are per serverless instance by default. When `name` and `sharedStore` are provided and the
 * store is usable (MongoDB connected), counters are shared across instances instead.
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

  const memoryHit = (clientKey: string, now: number): { count: number; resetTime: number } => {
    let record = clients.get(clientKey);
    if (!record || now > record.resetTime) {
      record = { count: 1, resetTime: now + windowMs };
      clients.set(clientKey, record);
    } else {
      record.count += 1;
    }
    return record;
  };

  const canUseShared = options.useSharedStore ?? isDbConnected;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // In test environment, bypass rate limiter unless explicitly enabled
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const clientKey = keyGenerator
      ? keyGenerator(req)
      : (req.user ? `user:${req.user.id}` : req.ip) || req.socket.remoteAddress || 'unknown-client';
    const now = Date.now();

    let record: { count: number; resetTime: number };
    if (options.sharedStore && options.name && canUseShared()) {
      try {
        record = await options.sharedStore.hit(`${options.name}:${clientKey}`, windowMs, now);
      } catch (err) {
        // Availability over strictness: degrade to the per-instance counter if the store errors.
        console.warn('[RateLimiter] Shared store unavailable, using per-instance counter:', formatSafeError(err));
        record = memoryHit(clientKey, now);
      }
    } else {
      record = memoryHit(clientKey, now);
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
  name: 'ai',
  sharedStore: mongoRateLimitStore,
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
  name: 'auth',
  sharedStore: mongoRateLimitStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 auth attempts per 15 minutes
  message: 'Too many authentication attempts. Please try again later.',
});

/** Stricter rate limiter for unauthenticated guest AI plan generation to prevent abuse */
export const guestAiRateLimiter = createRateLimiter({
  name: 'guest-ai',
  sharedStore: mongoRateLimitStore,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 guest plans per 15 minutes per IP
  message: 'Guest celebration plan generation limit reached. Please wait a few minutes or log in to continue.',
});

