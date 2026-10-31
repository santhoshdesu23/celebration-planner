import type { Request, Response, NextFunction, RequestHandler } from 'express';
import {
  configIssues as defaultConfigIssues,
  requiresDurableStorage,
  type ConfigIssue,
} from '../config/env.js';
import { connectDatabase, isDbConnected } from '../db/connection.js';

/** Normalises `/api/health/` -> `/api/health` for exemption checks. */
function fullPath(req: Request): string {
  const raw = `${req.baseUrl || ''}${req.path || ''}`;
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

const CONFIG_GUARD_EXEMPT = new Set(['/api', '/api/health']);

/**
 * Routes that never touch persistent storage (health/diagnostics, CSRF bootstrap, stateless logout,
 * and the guest AI endpoints which neither read nor write the database).
 */
const STORAGE_GUARD_EXEMPT = new Set([
  '/api',
  '/api/health',
  '/api/auth/csrf-token',
  '/api/auth/logout',
  '/api/events/guest-plan',
  '/api/events/guest-ai-assist',
]);

/**
 * Fails closed with 503 when production configuration is unsafe (e.g. missing/weak JWT_SECRET).
 * Details are logged at startup by variable name only; the response never reveals them.
 */
export function createConfigGuard(
  getIssues: () => readonly ConfigIssue[] = () => defaultConfigIssues
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!getIssues().some((issue) => issue.blocking) || CONFIG_GUARD_EXEMPT.has(fullPath(req))) {
      return next();
    }
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVER_MISCONFIGURED',
        message: 'The service is temporarily unavailable due to a server configuration problem.',
      },
    });
  };
}

export interface StorageGuardOptions {
  /** Whether writes to ephemeral memory must be refused (production). Defaults to env policy. */
  durableRequired?: () => boolean;
  /** Whether persistent storage is currently usable. Defaults to the Mongo connection state. */
  isReady?: () => boolean;
  /** Attempts to (re)establish persistent storage. Defaults to `connectDatabase`. */
  ensureReady?: () => Promise<unknown>;
  /** After a failed attempt, answer 503 immediately for this long instead of retrying. */
  retryCooldownMs?: number;
}

/**
 * Guarantees that, in production, data routes only run while MongoDB is reachable. A cold start or a
 * dropped connection triggers one shared reconnect attempt; if it fails the request gets
 * 503 STORAGE_UNAVAILABLE rather than being served from (and writing into) ephemeral memory.
 * Development and tests are unaffected, so the in-memory adapter keeps working for isolated tests.
 */
export function createStorageGuard(options: StorageGuardOptions = {}): RequestHandler {
  const durableRequired = options.durableRequired ?? requiresDurableStorage;
  const isReady = options.isReady ?? isDbConnected;
  const ensureReady = options.ensureReady ?? (() => connectDatabase());
  const cooldownMs = options.retryCooldownMs ?? 5_000;

  let inFlight: Promise<void> | null = null;
  let lastFailureAt = 0;

  const attempt = (): Promise<void> => {
    if (!inFlight) {
      inFlight = (async () => {
        try {
          await ensureReady();
        } catch {
          // Treated as not ready below; details are logged by the connection layer.
        } finally {
          if (!isReady()) lastFailureAt = Date.now();
          inFlight = null;
        }
      })();
    }
    return inFlight;
  };

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!durableRequired() || STORAGE_GUARD_EXEMPT.has(fullPath(req)) || isReady()) {
      return next();
    }

    if (Date.now() - lastFailureAt >= cooldownMs) {
      await attempt();
      if (isReady()) return next();
    }

    res.setHeader('Retry-After', Math.ceil(cooldownMs / 1000));
    res.status(503).json({
      success: false,
      error: {
        code: 'STORAGE_UNAVAILABLE',
        message: 'Persistent storage is temporarily unavailable. Please try again shortly.',
      },
    });
  };
}

/** API responses can carry session-specific data; forbid shared/browser caching. */
export function noStoreApiResponses(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}

