import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalRateLimiter } from './middleware/rateLimiter.js';
import { csrfProtection, isAllowedOrigin } from './middleware/csrf.js';
import { createConfigGuard, createStorageGuard, noStoreApiResponses } from './middleware/safeguards.js';
import healthRouter from './routes/health.js';
import eventsRouter from './routes/events.js';
import authRouter from './routes/auth.js';

export interface CreateAppOptions {
  /**
   * Establishes persistent storage (DB connection + migrations). Invoked by the storage guard BEFORE any
   * protected route runs, so serverless cold starts never reach the stores with a closed connection.
   */
  ensureReady?: () => Promise<unknown>;
}

export function createApp(options: CreateAppOptions = {}) {
  const app = express();

  // ── Trust reverse proxy (Vercel edge & lambdas) ─────────────────────────────
  app.set('trust proxy', 1);

  // ── Security headers ────────────────────────────────────────────────────────
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: [
            "'self'",
            ...env.CORS_ORIGIN.split(',').map((o) => o.trim()),
            ...(env.NODE_ENV !== 'production'
              ? ['http://localhost:*', 'http://127.0.0.1:*', 'ws://localhost:*', 'ws://127.0.0.1:*']
              : []),
          ],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  // ── CORS ────────────────────────────────────────────────────────────────────
  app.use(
    cors({
      origin: (requestOrigin, callback) => {
        if (!requestOrigin || isAllowedOrigin(requestOrigin)) {
          return callback(null, true);
        }
        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'x-csrf-token',
        'X-Requested-With',
      ],
      exposedHeaders: ['X-CSRF-Token'],
    })
  );

  // ── Cookie parsing ──────────────────────────────────────────────────────────
  app.use(cookieParser());

  // ── Body parsing ────────────────────────────────────────────────────────────
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  // ── URL path normalization for reverse proxies and serverless rewrites ───────
  app.use((req, _res, next) => {
    // If rewritten to entrypoint file (/api/index or /api/index.js), restore original URL
    if (
      req.originalUrl &&
      req.originalUrl.startsWith('/api') &&
      (!req.url || req.url.includes('/api/index'))
    ) {
      req.url = req.originalUrl;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
    }
    next();
  });

  // ── Request logging ─────────────────────────────────────────────────────────
  app.use(requestLogger);

  // ── Global API Rate Limiter ─────────────────────────────────────────────────
  app.use('/api', generalRateLimiter);

  // ── CSRF Protection (Double-submit cookie & Origin defense) ──────────────────
  app.use('/api', csrfProtection);

  // ── API responses are never cacheable (session-specific data) ────────────────
  app.use('/api', noStoreApiResponses);

  // ── Fail closed on unsafe production configuration (e.g. weak JWT_SECRET) ────
  app.use('/api', createConfigGuard());

  // ── Fail closed (503) when production storage is unavailable; never use memory ─
  app.use('/api', createStorageGuard({ ensureReady: options.ensureReady }));

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.get(['/api', '/api/'], (_req, res) => {
    res.json({
      success: true,
      message: 'Celebration Planner API is running',
      version: '1.0.0',
    });
  });
  app.use('/api/health', healthRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/events', eventsRouter);

  // ── 404 handler ─────────────────────────────────────────────────────────────
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Route not found' },
    });
  });

  // ── Error handler (must be last) ────────────────────────────────────────────
  app.use(errorHandler);

  return app;
}
