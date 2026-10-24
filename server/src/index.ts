import { createApp } from './app.js';
import { env, formatSafeError } from './config/env.js';
import { connectDatabase } from './db/connection.js';
import { migrateLegacyEvents } from './db/migration.js';
import { aiJobRunner } from './services/aiJobRunner.js';

async function start() {
  await connectDatabase();
  await migrateLegacyEvents();
  aiJobRunner.startBackgroundSweeper();
  const app = createApp();
  app.listen(env.PORT, () => {
    console.log(
      `🎉 Celebration Planner API running on http://localhost:${env.PORT} [${env.NODE_ENV}]`
    );
  });
}

start().catch((err) => {
  console.error('Failed to start server:', formatSafeError(err));
  process.exit(1);
});
