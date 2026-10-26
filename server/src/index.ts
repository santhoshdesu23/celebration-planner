import { createApp } from './createApp.js';
import { env, formatSafeError } from './config/env.js';
import { connectDatabase } from './db/connection.js';
import { migrateLegacyEvents } from './db/migration.js';
import { aiJobRunner } from './services/aiJobRunner.js';

const app = createApp();

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await connectDatabase();
        await migrateLegacyEvents().catch((err: unknown) => {
          console.warn('[Serverless] Migration notice:', err);
        });
        isInitialized = true;
      } catch (err: unknown) {
        console.error('[Serverless] DB connection error:', err);
        initPromise = null;
      }
    })();
  }
  await initPromise;
}

// Ensure database and migrations are connected before handling any route in serverless functions
app.use(async (_req, _res, next) => {
  try {
    await ensureInitialized();
    next();
  } catch (err) {
    next(err);
  }
});

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
if (Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'test') {
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
