import { createApp } from './createApp.js';
import { env, formatSafeError } from './config/env.js';
import { connectDatabase, isDbConnected } from './db/connection.js';
import { migrateLegacyEvents } from './db/migration.js';
import { aiJobRunner } from './services/aiJobRunner.js';

let migrated = false;
let initPromise: Promise<void> | null = null;

/**
 * Connects to MongoDB (and runs the one-time legacy migration) when needed.
 *
 * Safe for Vercel serverless: idempotent, shares one in-flight attempt between concurrent requests, and
 * retries on later requests after a failure (a failed connect is never cached as "initialized").
 */
export async function ensureInitialized(): Promise<void> {
  // Nothing to connect to (development/test without MONGODB_URI): in-memory adapter is used.
  if (!env.MONGODB_URI) return;
  if (isDbConnected() && migrated) return;

  if (!initPromise) {
    initPromise = (async () => {
      try {
        const connected = await connectDatabase();
        if (connected && !migrated) {
          await migrateLegacyEvents().catch((err: unknown) => {
            console.warn('[Serverless] Migration notice:', formatSafeError(err));
          });
          migrated = true;
        }
      } catch (err: unknown) {
        console.error('[Serverless] DB connection error:', formatSafeError(err));
      } finally {
        initPromise = null;
      }
    })();
  }
  await initPromise;
}

// The storage guard runs ensureInitialized() BEFORE protected routes, so database access never starts
// on a cold or disconnected instance. (Previously this was registered after the routes and never ran.)
const app = createApp({ ensureReady: ensureInitialized });

async function start() {
  await ensureInitialized();
  aiJobRunner.startBackgroundSweeper();
  app.listen(env.PORT, () => {
    console.log(
      `🎉 Celebration Planner API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`
    );
  });
}

// In local dev/node execution, start listening on PORT. On Vercel and in test runs, export app as default.
// No background process is required on Vercel: initialization is request-driven via the storage guard.
if (Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'test') {
  // Warm the connection at import time to shorten the first request; failures are retried per request.
  ensureInitialized().catch((err: unknown) => {
    console.error('Failed to initialize database on Vercel:', formatSafeError(err));
  });
} else {
  start().catch((err: unknown) => {
    console.error('Failed to start server:', formatSafeError(err));
    process.exit(1);
  });
}

export default app;
