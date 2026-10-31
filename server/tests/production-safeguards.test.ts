import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createConfigGuard, createStorageGuard } from '../src/middleware/safeguards.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import type { SharedRateLimitStore } from '../src/services/rateLimitStore.js';
import { generateToken, verifyToken } from '../src/utils/auth.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { createApp } from '../src/createApp.js';

function buildApp(...guards: express.RequestHandler[]) {
  const app = express();
  app.use('/api', ...guards);
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/events', (_req, res) => res.json({ data: [] }));
  app.post('/api/events', (_req, res) => res.status(201).json({ created: true }));
  app.post('/api/events/guest-plan', (_req, res) => res.json({ guest: true }));
  app.get('/api/auth/csrf-token', (_req, res) => res.json({ token: 't' }));
  return app;
}

describe('Config guard (fail closed on unsafe production config)', () => {
  const blocking = [{ variable: 'JWT_SECRET', message: 'JWT_SECRET is missing.', blocking: true }];

  it('returns 503 SERVER_MISCONFIGURED for API routes but keeps /api/health reachable', async () => {
    const app = buildApp(createConfigGuard(() => blocking));
    const events = await request(app).get('/api/events');
    expect(events.status).toBe(503);
    expect(events.body.error.code).toBe('SERVER_MISCONFIGURED');
    // Never leaks which variable is wrong or any value
    expect(JSON.stringify(events.body)).not.toContain('JWT_SECRET');

    expect((await request(app).get('/api/health')).status).toBe(200);
  });

  it('passes everything through when there are no blocking issues', async () => {
    const app = buildApp(createConfigGuard(() => [{ variable: 'X', message: 'warn', blocking: false }]));
    expect((await request(app).get('/api/events')).status).toBe(200);
  });
});

describe('Storage guard (no silent in-memory fallback in production)', () => {
  it('returns 503 STORAGE_UNAVAILABLE for data routes when MongoDB is down, and never reaches the route', async () => {
    const ensureReady = vi.fn().mockResolvedValue(false);
    const app = buildApp(
      createStorageGuard({ durableRequired: () => true, isReady: () => false, ensureReady })
    );

    const write = await request(app).post('/api/events').send({});
    expect(write.status).toBe(503);
    expect(write.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(write.headers['retry-after']).toBeDefined();

    expect((await request(app).get('/api/events')).status).toBe(503);
  });

  it('keeps health, CSRF bootstrap, and DB-free guest endpoints available while storage is down', async () => {
    const app = buildApp(
      createStorageGuard({ durableRequired: () => true, isReady: () => false, ensureReady: async () => false })
    );
    expect((await request(app).get('/api/health')).status).toBe(200);
    expect((await request(app).get('/api/auth/csrf-token')).status).toBe(200);
    expect((await request(app).post('/api/events/guest-plan').send({})).status).toBe(200);
  });

  it('retries the connection on the next request and recovers once storage is back', async () => {
    let ready = false;
    const ensureReady = vi.fn(async () => {
      ready = true; // second attempt succeeds
    });
    const app = buildApp(
      createStorageGuard({
        durableRequired: () => true,
        isReady: () => ready,
        ensureReady,
        retryCooldownMs: 0,
      })
    );
    const res = await request(app).get('/api/events');
    expect(res.status).toBe(200);
    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('shares one reconnect attempt across concurrent requests and applies a failure cooldown', async () => {
    const ensureReady = vi.fn(() => new Promise<void>((r) => setTimeout(r, 30)));
    const app = buildApp(
      createStorageGuard({
        durableRequired: () => true,
        isReady: () => false,
        ensureReady,
        retryCooldownMs: 60_000,
      })
    );
    const results = await Promise.all([1, 2, 3].map(() => request(app).get('/api/events')));
    expect(results.every((r) => r.status === 503)).toBe(true);
    expect(ensureReady).toHaveBeenCalledTimes(1);

    await request(app).get('/api/events'); // inside cooldown: no new attempt
    expect(ensureReady).toHaveBeenCalledTimes(1);
  });

  it('does not interfere with the in-memory adapter when durable storage is not required (dev/test)', async () => {
    const ensureReady = vi.fn();
    const app = buildApp(
      createStorageGuard({ durableRequired: () => false, isReady: () => false, ensureReady })
    );
    expect((await request(app).post('/api/events').send({})).status).toBe(201);
    expect(ensureReady).not.toHaveBeenCalled();
  });
});

describe('Database connectivity errors map to 503', () => {
  it('returns STORAGE_UNAVAILABLE for Mongo server selection errors without leaking details', async () => {
    const app = express();
    app.get('/boom', (_req, _res, next) => {
      const err = new Error('connect to mongodb://user:secretpw@host failed');
      err.name = 'MongooseServerSelectionError';
      next(err);
    });
    app.use(errorHandler);
    const res = await request(app).get('/boom');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('STORAGE_UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('secretpw');
  });
});

describe('Shared (cross-instance) rate limiting', () => {
  // Fake shared store emulating one MongoDB collection that two serverless instances both use.
  function makeSharedStore(): SharedRateLimitStore & { hits: Map<string, number> } {
    const hits = new Map<string, number>();
    return {
      hits,
      async hit(key, windowMs, now = Date.now()) {
        const windowIndex = Math.floor(now / windowMs);
        const id = `${key}:${windowIndex}`;
        const count = (hits.get(id) ?? 0) + 1;
        hits.set(id, count);
        return { count, resetTime: (windowIndex + 1) * windowMs };
      },
    };
  }

  const limiterApp = (limiter: express.RequestHandler) => {
    const app = express();
    app.get('/limited', limiter, (_req, res) => res.json({ ok: true }));
    return app;
  };

  it('counts requests across two independent limiter instances via the shared store', async () => {
    const store = makeSharedStore();
    const opts = { windowMs: 60_000, max: 3, name: 'test', sharedStore: store, useSharedStore: () => true };
    const instanceA = limiterApp(createRateLimiter(opts));
    const instanceB = limiterApp(createRateLimiter(opts));

    const headers = { 'x-test-rate-limit': '1' };
    const statuses: number[] = [];
    for (const app of [instanceA, instanceB, instanceA, instanceB, instanceA]) {
      statuses.push((await request(app).get('/limited').set(headers)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it('per-instance counters alone do NOT share state (documents the limitation being fixed)', async () => {
    const opts = { windowMs: 60_000, max: 2 };
    const instanceA = limiterApp(createRateLimiter(opts));
    const instanceB = limiterApp(createRateLimiter(opts));
    const headers = { 'x-test-rate-limit': '1' };
    const statuses: number[] = [];
    for (const app of [instanceA, instanceB, instanceA, instanceB]) {
      statuses.push((await request(app).get('/limited').set(headers)).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200]);
  });

  it('degrades to the per-instance counter if the shared store errors (availability)', async () => {
    const failing: SharedRateLimitStore = { hit: async () => { throw new Error('store down'); } };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const app = limiterApp(
      createRateLimiter({ windowMs: 60_000, max: 1, name: 'x', sharedStore: failing, useSharedStore: () => true })
    );
    const headers = { 'x-test-rate-limit': '1' };
    expect((await request(app).get('/limited').set(headers)).status).toBe(200);
    expect((await request(app).get('/limited').set(headers)).status).toBe(429);
    warn.mockRestore();
  });

  it('uses the per-instance counter when the shared store is not usable (no DB)', async () => {
    const store = makeSharedStore();
    const app = limiterApp(
      createRateLimiter({ windowMs: 60_000, max: 5, name: 'y', sharedStore: store, useSharedStore: () => false })
    );
    await request(app).get('/limited').set({ 'x-test-rate-limit': '1' });
    expect(store.hits.size).toBe(0);
  });
});

describe('JWT handling with an unconfigured secret', () => {
  it('verifyToken still works in test mode with the dev secret (workflow preserved)', () => {
    const token = generateToken({ id: 'u1', email: 'a@b.co', name: 'A' });
    expect(verifyToken(token)?.id).toBe('u1');
  });
});

describe('App wiring: init guard precedes protected routes', () => {
  it('invokes ensureReady before the route when durable storage is required via the guard', async () => {
    const order: string[] = [];
    const app = express();
    app.use(
      '/api',
      createStorageGuard({
        durableRequired: () => true,
        isReady: () => order.includes('init'),
        ensureReady: async () => {
          order.push('init');
        },
        retryCooldownMs: 0,
      })
    );
    app.get('/api/events', (_req, res) => {
      order.push('route');
      res.json({});
    });
    await request(app).get('/api/events');
    expect(order).toEqual(['init', 'route']);
  });

  it('createApp sets no-store on API responses and still serves health in test mode', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

