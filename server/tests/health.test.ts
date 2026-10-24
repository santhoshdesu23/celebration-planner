import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with success=true', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns expected data shape', async () => {
    const res = await request(app).get('/api/health');
    const { data } = res.body;
    expect(data.status).toBe('ok');
    expect(data.service).toBe('celebration-planner-api');
    expect(typeof data.timestamp).toBe('string');
    expect(typeof data.version).toBe('string');
  });

  it('returns a valid ISO timestamp', async () => {
    const res = await request(app).get('/api/health');
    const ts = res.body.data?.timestamp;
    expect(new Date(ts).toISOString()).toBe(ts);
  });
});

describe('404 handler', () => {
  it('returns 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error?.code).toBe('NOT_FOUND');
  });
});
