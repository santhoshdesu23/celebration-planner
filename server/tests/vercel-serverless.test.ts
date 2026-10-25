import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { EventEmitter } from 'node:events';

describe('Vercel Express Function Entrypoint (server/src/index.ts)', () => {
  it('exports a deployable Express app instance', async () => {
    const { default: app } = await import('../src/index.js');
    expect(typeof app).toBe('function');
  }, 15000);

  it('serves GET /api/health with status 200 and healthy payload', async () => {
    const { default: app } = await import('../src/index.js');
    const http = await import('node:http');

    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, async () => {
        const addr = server.address() as any;
        const port = addr.port;
        const res = await fetch(`http://localhost:${port}/api/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('ok');
        expect(data.data.service).toBe('celebration-planner-api');
        server.close(() => resolve());
      });
    });
  }, 15000);

  it('normalizes URLs stripped of /api prefix (e.g. /health -> /api/health)', async () => {
    const { default: app } = await import('../src/index.js');
    const http = await import('node:http');

    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, async () => {
        const addr = server.address() as any;
        const port = addr.port;
        const res = await fetch(`http://localhost:${port}/health`);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.status).toBe('ok');
        server.close(() => resolve());
      });
    });
  }, 15000);

  it('generates a guest plan via POST /api/events/guest-plan through serverless handler', async () => {
    const { default: app } = await import('../src/index.js');
    const http = await import('node:http');

    const server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(0, async () => {
        const addr = server.address() as any;
        const port = addr.port;
        const res = await fetch(`http://localhost:${port}/api/events/guest-plan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Origin: `http://localhost:${port}`,
          },
          body: JSON.stringify({
            title: 'Serverless Golden Anniversary',
            type: 'anniversary',
            eventDate: '2027-11-20T18:00:00.000Z',
            guestCount: 65,
            location: 'Grand Ballroom',
            budget: { currency: 'USD', totalBudget: 12000, items: [] },
          }),
        });

        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data.success).toBe(true);
        expect(data.data.title).toBe('Serverless Golden Anniversary');
        expect(data.data.ownerId).toBe('guest');
        expect(data.data.status).toBe('draft');
        expect(Array.isArray(data.data.ideas)).toBe(true);
        server.close(() => resolve());
      });
    });
  }, 15000);
});
