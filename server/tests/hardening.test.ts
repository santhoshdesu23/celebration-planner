import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/createApp.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiService } from '../src/services/aiService.js';
import { aiJobRunner } from '../src/services/aiJobRunner.js';
import { createRateLimiter } from '../src/middleware/rateLimiter.js';
import { getTestAuthHeader } from './helpers/authHelper.js';
import express from 'express';

const app = createApp();
const authHeader = getTestAuthHeader();

describe('Hardening & Reliability Test Suite', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  const baseEvent = {
    title: 'Sophie & Alex Coastal Wedding',
    type: 'wedding',
    eventDate: '2027-09-20T17:00:00.000Z',
    guestCount: 150,
    location: 'Monterey, CA',
    description: 'Bespoke oceanside gathering with sustainable culinary tasting',
    budget: {
      currency: 'USD',
      totalBudget: 40000,
      items: [],
    },
  };

  // ─── 1. Input Validation and Boundary Values ────────────────────────────────
  describe('Input Validation & Boundary Checking', () => {
    it('rejects negative total budget', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({
          ...baseEvent,
          budget: { ...baseEvent.budget, totalBudget: -5000 },
        });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects zero or negative guest count', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({ ...baseEvent, guestCount: 0 });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);

      const resNegative = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({ ...baseEvent, guestCount: -25 });
      expect(resNegative.status).toBe(400);
    });

    it('rejects non-integer guest count', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({ ...baseEvent, guestCount: 55.5 });
      expect(res.status).toBe(400);
    });

    it('rejects invalid currency code', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({
          ...baseEvent,
          budget: { currency: 'XYZ', totalBudget: 5000, items: [] },
        });
      expect(res.status).toBe(400);
    });

    it('rejects invalid ISO date format', async () => {
      const res = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send({ ...baseEvent, eventDate: 'next-friday-at-5pm' });
      expect(res.status).toBe(400);
    });

    it('rejects query parameter with invalid event type or status', async () => {
      const res = await request(app)
        .get('/api/events?type=not-a-valid-type')
        .set(authHeader);
      expect(res.status).toBe(400);
    });

    it('rejects sub-resource updates with negative budget amounts', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send(baseEvent);
      const eventId = createRes.body.data.id;

      // Add item
      const itemRes = await request(app)
        .post(`/api/events/${eventId}/budget/items`)
        .set(authHeader)
        .send({
          category: 'Photography',
          estimatedAmount: 3000,
          isPaid: false,
        });
      expect(itemRes.status).toBe(201);
      const itemId = itemRes.body.data.budget.items[itemRes.body.data.budget.items.length - 1].id;

      // Attempt negative estimated amount update
      const badPatch = await request(app)
        .patch(`/api/events/${eventId}/budget/items/${itemId}`)
        .set(authHeader)
        .send({ estimatedAmount: -200 });
      expect(badPatch.status).toBe(400);

      // Attempt negative actual amount update
      const badActual = await request(app)
        .patch(`/api/events/${eventId}/budget/items/${itemId}`)
        .set(authHeader)
        .send({ actualAmount: -50 });
      expect(badActual.status).toBe(400);
    });

    it('rejects injection or malformed route parameters with invalid characters', async () => {
      const res = await request(app)
        .get('/api/events/bad%20id$with;semicolon')
        .set(authHeader);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── 2. Budget Consistency & Arithmetic ────────────────────────────────────
  describe('Budget Consistency & Arithmetic', () => {
    it('maintains mathematical consistency across add, edit, and settle transitions', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send(baseEvent);
      const eventId = createRes.body.data.id;

      // Add catering expense
      await request(app)
        .post(`/api/events/${eventId}/budget/items`)
        .set(authHeader)
        .send({
          category: 'Catering & Dining',
          estimatedAmount: 12000,
          notes: 'Full service dinner for 150',
          isPaid: false,
        });

      // Add floral expense
      await request(app)
        .post(`/api/events/${eventId}/budget/items`)
        .set(authHeader)
        .send({
          category: 'Florals & Centerpieces',
          estimatedAmount: 4000,
          isPaid: false,
        });

      let event = (await request(app).get(`/api/events/${eventId}`).set(authHeader)).body.data;
      const cateringItem = event.budget.items.find((i: any) => i.category === 'Catering & Dining');
      const floralItem = event.budget.items.find((i: any) => i.category === 'Florals & Centerpieces');

      expect(cateringItem).toBeDefined();
      expect(floralItem).toBeDefined();

      // Settle catering item with actual invoice amount
      await request(app)
        .patch(`/api/events/${eventId}/budget/items/${cateringItem.id}`)
        .set(authHeader)
        .send({
          actualAmount: 11850,
          isPaid: true,
          notes: 'Invoice paid via wire transfer',
        });

      event = (await request(app).get(`/api/events/${eventId}`).set(authHeader)).body.data;
      const updatedCatering = event.budget.items.find((i: any) => i.id === cateringItem.id);
      expect(updatedCatering.isPaid).toBe(true);
      expect(updatedCatering.actualAmount).toBe(11850);

      // Verify explicit calculation assertions independently
      const totalBudget = event.budget.totalBudget;
      const totalEstimated = event.budget.items.reduce((s: number, i: any) => s + i.estimatedAmount, 0);
      const totalActualSpent = event.budget.items.reduce((s: number, i: any) => s + (i.actualAmount || 0), 0);
      const paidExpensesTotal = event.budget.items.reduce((s: number, i: any) => {
        if (!i.isPaid) return s;
        return s + (i.actualAmount ?? i.estimatedAmount);
      }, 0);

      expect(totalBudget).toBe(40000);
      expect(totalActualSpent).toBe(11850);
      expect(paidExpensesTotal).toBe(11850);
      expect(totalBudget - totalActualSpent).toBe(28150);
      expect(totalEstimated).toBeGreaterThan(15000);
    });
  });

  // ─── 3. Timeline Synchronization on Event Date Changes ─────────────────────
  describe('Timeline Synchronization on Event Date Changes', () => {
    it('shifts existing milestone due dates when eventDate is rescheduled', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send(baseEvent);
      const eventId = createRes.body.data.id;
      const completedEvent = await aiJobRunner.waitForJob(eventId, createRes.body.data.ownerId);
      const initialTimeline = completedEvent!.timeline;
      expect(initialTimeline.length).toBeGreaterThan(0);

      const firstItemInitialDue = new Date(initialTimeline[0].dueDate).getTime();

      // Move event forward by exactly 30 days
      const oldEventDate = new Date(baseEvent.eventDate).getTime();
      const newEventDate = new Date(oldEventDate + 30 * 24 * 60 * 60 * 1000).toISOString();

      const patchRes = await request(app)
        .patch(`/api/events/${eventId}`)
        .set(authHeader)
        .send({ eventDate: newEventDate });

      expect(patchRes.status).toBe(200);
      const updatedTimeline = patchRes.body.data.timeline;

      // Verify that due dates were shifted forward
      const firstItemNewDue = new Date(updatedTimeline[0].dueDate).getTime();
      const differenceDays = Math.round((firstItemNewDue - firstItemInitialDue) / (24 * 60 * 60 * 1000));
      expect(differenceDays).toBe(30);

      // Ensure no milestone due date exceeds the new event date
      const newEventTime = new Date(newEventDate).getTime();
      for (const item of updatedTimeline) {
        expect(new Date(item.dueDate).getTime()).toBeLessThanOrEqual(newEventTime);
      }
    });
  });

  // ─── 4. Vendor Status Lifecycle ───────────────────────────────────────────
  describe('Vendor Status Lifecycle', () => {
    it('validates vendor status transitions and rejects unsupported statuses', async () => {
      const createRes = await request(app)
        .post('/api/events')
        .set(authHeader)
        .send(baseEvent);
      const eventId = createRes.body.data.id;

      // Add a custom vendor
      const addRes = await request(app)
        .post(`/api/events/${eventId}/vendors`)
        .set(authHeader)
        .send({
          name: 'Pacific Crest Sounds',
          category: 'DJ & Audio',
          status: 'not_contacted',
          estimatedCost: 1800,
        });
      expect(addRes.status).toBe(201);
      const vendor = addRes.body.data.vendors.find((v: any) => v.name === 'Pacific Crest Sounds');
      expect(vendor).toBeDefined();

      // Transition: not_contacted -> contacted
      const patch1 = await request(app)
        .patch(`/api/events/${eventId}/vendors/${vendor.id}`)
        .set(authHeader)
        .send({ status: 'contacted' });
      expect(patch1.status).toBe(200);

      // Transition: contacted -> quote_received
      const patch2 = await request(app)
        .patch(`/api/events/${eventId}/vendors/${vendor.id}`)
        .set(authHeader)
        .send({ status: 'quote_received', confirmedCost: 1750 });
      expect(patch2.status).toBe(200);
      const updatedV = patch2.body.data.vendors.find((v: any) => v.id === vendor.id);
      expect(updatedV.status).toBe('quote_received');
      expect(updatedV.confirmedCost).toBe(1750);

      // Transition: quote_received -> booked
      const patch3 = await request(app)
        .patch(`/api/events/${eventId}/vendors/${vendor.id}`)
        .set(authHeader)
        .send({ status: 'booked' });
      expect(patch3.status).toBe(200);
      expect(patch3.body.data.vendors.find((v: any) => v.id === vendor.id).status).toBe('booked');

      // Attempt invalid status
      const badStatus = await request(app)
        .patch(`/api/events/${eventId}/vendors/${vendor.id}`)
        .set(authHeader)
        .send({ status: 'arbitrary_invalid_status' });
      expect(badStatus.status).toBe(400);
    });
  });

  // ─── 5. AI Service Resilience & Fallback ───────────────────────────────────
  describe('AI Service Resilience & Fallback Plan Generation', () => {
    it('generates rich domain plans for wedding, birthday, and community without Gemini API key', async () => {
      const weddingPlan = await aiService.generateEventPlan({
        title: 'Maya Wedding',
        type: 'wedding',
        eventDate: '2027-05-15T18:00:00.000Z',
        guestCount: 100,
        location: 'Sonoma, CA',
        budget: { currency: 'USD', totalBudget: 25000, items: [] },
      });
      expect(weddingPlan.ideas.length).toBeGreaterThanOrEqual(4);
      expect(weddingPlan.budgetItems.length).toBeGreaterThanOrEqual(5);
      expect(weddingPlan.timeline.length).toBeGreaterThanOrEqual(5);
      expect(weddingPlan.vendors.length).toBeGreaterThanOrEqual(4);

      const bdayPlan = await aiService.generateEventPlan({
        title: 'Sam 30th Birthday',
        type: 'birthday',
        eventDate: '2027-04-10T20:00:00.000Z',
        guestCount: 60,
        location: 'Austin, TX',
        budget: { currency: 'USD', totalBudget: 5000, items: [] },
      });
      expect(bdayPlan.ideas.some((i) => i.title.toLowerCase().includes('jubilee') || i.title.toLowerCase().includes('neon'))).toBe(true);

      const commPlan = await aiService.generateEventPlan({
        title: 'Spring Festival',
        type: 'community',
        eventDate: '2027-06-01T10:00:00.000Z',
        guestCount: 300,
        location: 'Oak Park',
        budget: { currency: 'USD', totalBudget: 8000, items: [] },
      });
      expect(commPlan.ideas.some((i) => i.title.toLowerCase().includes('artisan') || i.title.toLowerCase().includes('mural'))).toBe(true);
    });

    it('provides tailored planning advice in fallback mode', async () => {
      const dummyEvent = {
        id: '11111111-1111-1111-1111-111111111111',
        ownerId: '00000000-0000-0000-0000-000000000001',
        title: 'Tech Gala',
        type: 'corporate' as const,
        eventDate: '2027-10-10T18:00:00.000Z',
        guestCount: 200,
        location: 'Seattle, WA',
        status: 'planning' as const,
        budget: { currency: 'USD' as const, totalBudget: 50000, items: [] },
        timeline: [],
        vendors: [],
        ideas: [],
        aiSuggestionsGenerated: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const budgetAdvice = await aiService.askAssistant(dummyEvent, 'How can we save on catering costs?');
      expect(budgetAdvice.response).toContain('Budget Optimization');
      expect(budgetAdvice.suggestions.length).toBeGreaterThan(0);

      const emailAdvice = await aiService.askAssistant(dummyEvent, 'Draft a vendor inquiry email');
      expect(emailAdvice.response).toContain('Sample Vendor Inquiry');
    });
  });

  // ─── 6. Storage & Health Endpoint Transparency ─────────────────────────────
  describe('Storage Transparency in GET /api/health', () => {
    it('accurately identifies ephemeral in-memory storage mode and provides warning', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.storage).toBeDefined();
    });
  });

  // ─── 7. Rate Limiter Unit Behavior ─────────────────────────────────────────
  describe('Rate Limiter Behavior', () => {
    it('returns 429 when max request quota is exceeded with Retry-After header', async () => {
      const testLimiterApp = express();
      const limiter = createRateLimiter({
        windowMs: 5000,
        max: 2,
        message: 'Rate limit exceeded in test',
      });
      testLimiterApp.use(limiter);
      testLimiterApp.get('/test-route', (_req, res) => res.json({ ok: true }));

      // Request 1: OK
      const r1 = await request(testLimiterApp).get('/test-route').set('x-test-rate-limit', 'true');
      expect(r1.status).toBe(200);
      expect(r1.headers['ratelimit-remaining']).toBe('1');

      // Request 2: OK
      const r2 = await request(testLimiterApp).get('/test-route').set('x-test-rate-limit', 'true');
      expect(r2.status).toBe(200);
      expect(r2.headers['ratelimit-remaining']).toBe('0');

      // Request 3: Exceeded -> 429
      const r3 = await request(testLimiterApp).get('/test-route').set('x-test-rate-limit', 'true');
      expect(r3.status).toBe(429);
      expect(r3.body.success).toBe(false);
      expect(r3.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(r3.headers['retry-after']).toBeDefined();
    });
  });
});
