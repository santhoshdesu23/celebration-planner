import { Router } from 'express';
import { isDbConnected, isUsingMemory, getDbConnectionError } from '../db/connection.js';
import { env } from '../config/env.js';

const router = Router();

/**
 * GET /api/health
 *
 * Returns service liveness, storage durability state, and AI status.
 */
router.get('/', (_req, res) => {
  const dbConnected = isDbConnected();
  const usingMemory = isUsingMemory();
  const dbError = getDbConnectionError();
  const aiConfigured = Boolean(
    env.GEMINI_API_KEY &&
      !env.GEMINI_API_KEY.includes('your_gemini') &&
      !env.GEMINI_API_KEY.includes('placeholder')
  );

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      service: 'celebration-planner-api',
      version: '1.0.0',
      environment: env.NODE_ENV ?? 'unknown',
      timestamp: new Date().toISOString(),
      storage: {
        type: dbConnected ? 'mongodb' : 'in-memory',
        isDurable: dbConnected,
        warning: usingMemory
          ? (dbError || env.MONGODB_URI
              ? 'Operating in transient in-memory fallback mode due to database connection issue. Data will not survive process restarts.'
              : 'Data is stored in transient in-memory store and will not survive process restarts. Configure MONGODB_URI for durable persistence.')
          : undefined,
        error: dbError || undefined,
      },
      aiProvider: {
        configured: aiConfigured,
        model: 'gemini-1.5-flash',
        fallbackAvailable: true,
      },
    },
  });
});

export default router;
