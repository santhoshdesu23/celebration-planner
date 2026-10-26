import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/createApp.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiJobRunner } from '../src/services/aiJobRunner.js';
import { aiService } from '../src/services/aiService.js';
import { getTestAuthHeader } from './helpers/authHelper.js';

const app = createApp();

const userA = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'usera-p24@example.com',
  name: 'User A',
};
const userB = {
  id: '22222222-2222-2222-2222-222222222222',
  email: 'userb-p24@example.com',
  name: 'User B',
};

const authHeaderA = getTestAuthHeader(userA);
const authHeaderB = getTestAuthHeader(userB);

const baseEventInput = {
  title: 'Elena & Lucas Anniversary Gala',
  type: 'anniversary',
  eventDate: '2027-11-20T19:00:00.000Z',
  guestCount: 85,
  location: 'Symphony Hall, Boston, MA',
  description: 'An elegant black-tie evening celebration with classical music and dining',
  budget: {
    currency: 'USD',
    totalBudget: 40000,
    items: [],
  },
};

describe('P2.4 Event-Creation Latency & Asynchronous AI Plan Generation Suite', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  // ─── 1. Durable Event Creation Latency ──────────────────────────────────────
  describe('Durable Persistence and Latency Separation', () => {
    it('persists event immediately and returns 201 before AI plan completes', async () => {
      const startTime = performance.now();
      const res = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const creationLatency = performance.now() - startTime;

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      const event = res.body.data;
      expect(event.id).toBeDefined();
      expect(event.ownerId).toBe(userA.id);
      expect(event.title).toBe(baseEventInput.title);
      expect(['pending', 'processing']).toContain(event.aiPlanStatus);

      // Verify event is immediately durable and queryable in store
      const persisted = await eventStore.findById(event.id, userA.id);
      expect(persisted).not.toBeNull();
      expect(persisted!.title).toBe(baseEventInput.title);

      // Initial HTTP response should be sub-300ms even under coverage instrumentation (durable insert without waiting on LLM)
      expect(creationLatency).toBeLessThan(300);
    });

    it('exposes plan status via GET /api/events/:id/ai-status', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const eventId = res.body.data.id;

      const statusRes = await request(app)
        .get(`/api/events/${eventId}/ai-status`)
        .set(authHeaderA);

      expect(statusRes.status).toBe(200);
      expect(statusRes.body.success).toBe(true);
      expect(statusRes.body.data.eventId).toBe(eventId);
      expect(['pending', 'processing', 'completed']).toContain(statusRes.body.data.aiPlanStatus);
    });
  });

  // ─── 2. Asynchronous Plan Completion ─────────────────────────────────────────
  describe('Asynchronous Plan Completion', () => {
    it('completes AI plan in background and populates timeline, ideas, and vendors', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const eventId = createRes.body.data.id;

      // Wait for background job runner to complete
      const completed = await aiJobRunner.waitForJob(eventId, userA.id);
      expect(completed).not.toBeNull();
      expect(completed!.aiPlanStatus).toBe('completed');
      expect(completed!.aiSuggestionsGenerated).toBe(true);
      expect(completed!.ideas.length).toBeGreaterThan(0);
      expect(completed!.timeline.length).toBeGreaterThan(0);
      expect(completed!.vendors.length).toBeGreaterThan(0);

      // Verify GET /ai-status reports completed
      const statusRes = await request(app)
        .get(`/api/events/${eventId}/ai-status`)
        .set(authHeaderA);
      expect(statusRes.body.data.aiPlanStatus).toBe('completed');
      expect(statusRes.body.data.aiSuggestionsGenerated).toBe(true);
    });
  });

  // ─── 3. Custom Budget Preservation ──────────────────────────────────────────
  describe('Custom Budget Item Preservation', () => {
    it('preserves user custom budget items and does not overwrite them during AI plan generation', async () => {
      const customItemId = crypto.randomUUID();
      const customEventInput = {
        ...baseEventInput,
        budget: {
          currency: 'USD',
          totalBudget: 45000,
          items: [
            {
              id: customItemId,
              category: 'Custom Symphony Orchestra',
              estimatedAmount: 8500,
              actualAmount: 8000,
              isPaid: true,
              notes: 'Contract signed directly by client',
            },
          ],
        },
      };

      const createRes = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(customEventInput);
      expect(createRes.status).toBe(201);
      const eventId = createRes.body.data.id;

      // Await background AI completion
      const completed = await aiJobRunner.waitForJob(eventId, userA.id);
      expect(completed).not.toBeNull();

      // Ensure custom item was preserved completely
      expect(completed!.budget.items.length).toBe(1);
      const preservedItem = completed!.budget.items[0];
      expect(preservedItem.id).toBe(customItemId);
      expect(preservedItem.category).toBe('Custom Symphony Orchestra');
      expect(preservedItem.estimatedAmount).toBe(8500);
      expect(preservedItem.isPaid).toBe(true);
    });
  });

  // ─── 4. Concurrency & Duplicate Request Protection ───────────────────────────
  describe('Concurrency & Duplicate Generation Protection', () => {
    it('prevents concurrent retry/regeneration requests from causing duplicate AI calls', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const eventId = createRes.body.data.id;

      // Wait for initial plan to complete
      await aiJobRunner.waitForJob(eventId, userA.id);

      // Simulate non-instantaneous AI generation so concurrent requests overlap
      const originalGenerate = aiService.generateEventPlan;
      const spy = vi.spyOn(aiService, 'generateEventPlan').mockImplementation(async (evt) => {
        await new Promise((r) => setTimeout(r, 60));
        return originalGenerate.call(aiService, evt);
      });

      try {
        // Attempt concurrent retry requests simultaneously
        const [res1, res2] = await Promise.all([
          request(app).post(`/api/events/${eventId}/retry-ai`).set(authHeaderA),
          request(app).post(`/api/events/${eventId}/retry-ai`).set(authHeaderA),
        ]);

        // Exactly one request should succeed (200), and the second should be safely rejected with 409
        const statuses = [res1.status, res2.status].sort();
        expect(statuses).toEqual([200, 409]);

        const conflictRes = res1.status === 409 ? res1 : res2;
        expect(conflictRes.body.success).toBe(false);
        expect(conflictRes.body.error.code).toBe('GENERATION_IN_PROGRESS');
      } finally {
        spy.mockRestore();
        await aiJobRunner.waitForJob(eventId, userA.id);
      }
    });
  });

  // ─── 5. Failure & Recoverable Error Handling ─────────────────────────────────
  describe('Provider Failure & Recoverable Error State', () => {
    it('records failure safely and allows user to retry without losing event data', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const eventId = createRes.body.data.id;

      // Simulate provider failure
      await eventStore.failAiPlan(eventId, userA.id, 'Gemini quota exceeded');

      // Verify status endpoint reflects failure
      const statusRes = await request(app)
        .get(`/api/events/${eventId}/ai-status`)
        .set(authHeaderA);
      expect(statusRes.status).toBe(200);
      expect(statusRes.body.data.aiPlanStatus).toBe('failed');
      expect(statusRes.body.data.aiPlanError).toContain('Gemini quota exceeded');

      // Verify event is still completely intact
      const eventCheck = await eventStore.findById(eventId, userA.id);
      expect(eventCheck).not.toBeNull();
      expect(eventCheck!.title).toBe(baseEventInput.title);
      expect(eventCheck!.budget.totalBudget).toBe(baseEventInput.budget.totalBudget);

      // Trigger retry
      const retryRes = await request(app)
        .post(`/api/events/${eventId}/retry-ai`)
        .set(authHeaderA);
      expect(retryRes.status).toBe(200);
      expect(retryRes.body.success).toBe(true);

      // Await successful background completion
      const recovered = await aiJobRunner.waitForJob(eventId, userA.id);
      expect(recovered).not.toBeNull();
      expect(recovered!.aiPlanStatus).toBe('completed');
    });
  });

  // ─── 6. Cross-Tenant Authorization ───────────────────────────────────────────
  describe('Cross-Tenant Authorization & Isolation', () => {
    it('rejects User B from inspecting or mutating User A plan status', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeaderA)
        .send(baseEventInput);
      const eventId = createRes.body.data.id;

      // User B attempts to read AI status
      const getB = await request(app)
        .get(`/api/events/${eventId}/ai-status`)
        .set(authHeaderB);
      expect(getB.status).toBe(404);
      expect(getB.body.success).toBe(false);

      // User B attempts to retry User A's AI plan
      const retryB = await request(app)
        .post(`/api/events/${eventId}/retry-ai`)
        .set(authHeaderB);
      expect(retryB.status).toBe(404);
      expect(retryB.body.success).toBe(false);

      // User B attempts to regenerate User A's AI plan
      const regenB = await request(app)
        .post(`/api/events/${eventId}/regenerate-ai`)
        .set(authHeaderB);
      expect(regenB.status).toBe(404);
      expect(regenB.body.success).toBe(false);
    });
  });

  // ─── 7. Performance Benchmark ────────────────────────────────────────────────
  describe('Performance Benchmark Measurement', () => {
    it('measures event creation latency separately from background AI plan generation', async () => {
      const iterations = 5;
      const creationLatencies: number[] = [];
      const planGenerationLatencies: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        const res = await request(app)
          .post('/api/events')
          .set(authHeaderA)
          .send({
            ...baseEventInput,
            title: `Benchmark Event ${i + 1}`,
          });
        const t1 = performance.now();
        creationLatencies.push(t1 - t0);

        const eventId = res.body.data.id;
        await aiJobRunner.waitForJob(eventId, userA.id);
        const t2 = performance.now();
        planGenerationLatencies.push(t2 - t1);
      }

      const avgCreation = creationLatencies.reduce((a, b) => a + b, 0) / iterations;
      const avgPlan = planGenerationLatencies.reduce((a, b) => a + b, 0) / iterations;

      console.log(`[P2.4 Benchmark] Average Event-Creation Response Latency: ${avgCreation.toFixed(2)}ms`);
      console.log(`[P2.4 Benchmark] Average Background AI Plan Generation Time: ${avgPlan.toFixed(2)}ms`);

      expect(avgCreation).toBeLessThan(50);
      expect(avgPlan).toBeGreaterThan(0);
    });
  });
});
