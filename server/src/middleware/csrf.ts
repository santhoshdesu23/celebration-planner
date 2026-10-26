import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generates a cryptographically secure random token for CSRF protection.
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * Sets the csrf_token cookie with matching security parameters.
 * Note: httpOnly must be false so the client single-page application can read
 * it to submit the double-submit X-CSRF-Token header.
 */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clears the csrf_token cookie on logout or invalidation.
 */
export function clearCsrfCookie(res: Response): void {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'strict' : 'lax',
    path: '/',
  });
}

/**
 * Checks whether an origin is allowed according to CORS_ORIGIN and development settings.
 */
export function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.trim().toLowerCase();
  const configured = env.CORS_ORIGIN.split(',').map((o) => o.trim().toLowerCase());
  if (configured.includes(normalized)) return true;

  if (env.NODE_ENV !== 'production') {
    // In development and test environments, allow any local dev server port on localhost or 127.0.0.1
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?$/.test(normalized)) {
      return true;
    }
  }

  // Support Vercel production, preview, and deployment URLs
  if (process.env.VERCEL || process.env.VERCEL_URL) {
    if (process.env.VERCEL_URL && normalized === `https://${process.env.VERCEL_URL.toLowerCase()}`) {
      return true;
    }
    if (
      process.env.VERCEL_PROJECT_PRODUCTION_URL &&
      normalized === `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL.toLowerCase()}`
    ) {
      return true;
    }
    if (/^https:\/\/[a-z0-9-_.]+\.vercel\.app$/.test(normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Retrieves the explicit set of allowed origins for CSRF and cross-origin verification.
 * Untrusted client-supplied Host headers are excluded to prevent Host Header Poisoning.
 */
export function getAllowedOrigins(_req?: Request): Set<string> {
  const configured = env.CORS_ORIGIN.split(',').map((o) => o.trim().toLowerCase());
  const allowed = new Set(configured);

  if (env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:5173');
    allowed.add('http://127.0.0.1:5173');
    allowed.add('http://localhost:5174');
    allowed.add('http://127.0.0.1:5174');
    allowed.add('http://localhost:5175');
    allowed.add('http://127.0.0.1:5175');
    allowed.add(`http://localhost:${env.PORT}`);
    allowed.add(`http://127.0.0.1:${env.PORT}`);
    allowed.add('http://localhost:3001');
    allowed.add('http://127.0.0.1:3001');
  }

  return allowed;
}

export interface ExtractedOrigin {
  origin: string | null;
  isMalformed: boolean;
}

/**
 * Extracts and normalizes the request origin from Origin or Referer header.
 * Flags malformed Referer headers for rejection.
 */
export function extractOrigin(req: Request): ExtractedOrigin {
  const origin = req.headers.origin;
  if (origin && typeof origin === 'string') {
    return { origin: origin.toLowerCase(), isMalformed: false };
  }
  const referer = req.headers.referer;
  if (referer && typeof referer === 'string') {
    try {
      const parsed = new URL(referer);
      return { origin: parsed.origin.toLowerCase(), isMalformed: false };
    } catch {
      return { origin: null, isMalformed: true };
    }
  }
  return { origin: null, isMalformed: false };
}

/**
 * Constant-time comparison for CSRF tokens using crypto.timingSafeEqual.
 * Validates presence, types, and lengths prior to buffer comparison.
 */
export function safeTokenCompare(cookieToken?: unknown, headerToken?: unknown): boolean {
  if (typeof cookieToken !== 'string' || typeof headerToken !== 'string') {
    return false;
  }
  if (!cookieToken || !headerToken) {
    return false;
  }
  const cookieBuf = Buffer.from(cookieToken);
  const headerBuf = Buffer.from(headerToken);
  if (cookieBuf.length !== headerBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(cookieBuf, headerBuf);
}

/**
 * Double-submit cookie & origin verification middleware for CSRF defense.
 * Protects state-changing requests (POST, PATCH, PUT, DELETE).
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Safe HTTP methods do not mutate state
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // 1. Validate Origin / Referer against allowed origins if provided
  const { origin: requestOrigin, isMalformed } = extractOrigin(req);
  if (isMalformed) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_ERROR',
        message: 'Malformed Referer header rejected.',
      },
    });
    return;
  }

  if (requestOrigin) {
    const allowedOrigins = getAllowedOrigins(req);
    if (!allowedOrigins.has(requestOrigin) && !isAllowedOrigin(requestOrigin)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_ERROR',
          message: 'Cross-origin request rejected.',
        },
      });
      return;
    }
  }

  // 2. For requests authenticated via cookie or when a CSRF cookie is present, require a matching CSRF header
  const hasAuthCookie = Boolean(req.cookies?.auth_token);
  const hasCsrfCookie = Boolean(req.cookies?.[CSRF_COOKIE_NAME]);

  if (hasAuthCookie || hasCsrfCookie) {
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
    const rawHeader =
      req.headers['x-csrf-token'] ||
      req.headers['x-xsrf-token'] ||
      req.headers['csrf-token'];
    const headerToken = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

    if (!safeTokenCompare(cookieToken, headerToken)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CSRF_ERROR',
          message:
            'Invalid or missing CSRF token. State-changing requests must supply a valid X-CSRF-Token header matching the csrf_token cookie.',
        },
      });
      return;
    }
  }

  next();
}
