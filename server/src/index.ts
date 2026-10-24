import { createApp } from './app.js';
import { env, formatSafeError } from './config/env.js';
import { connectDatabase } from './db/connection.js';
import { migrateLegacyEvents } from './db/migration.js';
import { aiJobRunner } from './services/aiJobRunner.js';

const app = createApp();

let isInitialized = false;
export async function ensureInitialized(): Promise<void> {
  if (isInitialized) return;
  await connectDatabase();
  await migrateLegacyEvents().catch((err: unknown) => {
    console.warn('Migration notice:', err);
  });
  isInitialized = true;
}

async function start() {
  await ensureInitialized();
  aiJobRunner.startBackgroundSweeper();
  app.listen(env.PORT, () => {
    console.log(
      `🎉 Celebration Planner API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`
    );
  });
}

// In local dev/node execution, start listening on PORT. On Vercel, export app as default.
if (process.env.VERCEL === '1') {
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
