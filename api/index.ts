import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../server/dist/app.js';
import { connectDatabase } from '../server/dist/db/connection.js';
import { migrateLegacyEvents } from '../server/dist/db/migration.js';

let appInstance: ReturnType<typeof createApp> | null = null;
let initPromise: Promise<void> | null = null;

async function initServerless(): Promise<void> {
  try {
    // Lazily establish and cache database connection across warm invocations
    await connectDatabase();
    await migrateLegacyEvents().catch((err: unknown) => {
      console.warn('[Vercel Serverless] Migration notice:', err);
    });
  } catch (err: unknown) {
    console.error('[Vercel Serverless] DB connection error:', err);
  }
  // Construct Express application (do not start listening on a port)
  appInstance = createApp();
}

/**
 * Vercel Serverless Function entry point.
 * Wraps the Express application without spawning in-process timers or port listeners.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!appInstance) {
    if (!initPromise) {
      initPromise = initServerless();
    }
    await initPromise;
  }

  // Normalize URL path to ensure Express routes mounted under '/api' match reliably
  if (req.url && !req.url.startsWith('/api')) {
    req.url = `/api${req.url.startsWith('/') ? '' : '/'}${req.url}`;
  }

  return (appInstance as any)(req, res);
}
