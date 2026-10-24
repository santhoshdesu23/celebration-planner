import { describe, it, expect, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { eventStore } from '../src/services/eventStore.js';
import { getTestAuthHeader } from './helpers/authHelper.js';

const app = createApp();
const authHeader = getTestAuthHeader({
  id: 'user-test-guest-owner',
  email: 'guestowner@example.com',
  name: 'Guest Owner',
});

describe('Guest Planning API (/api/events/guest-plan & save-guest-plan)', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  const validGuestPlanInput = {
    title: 'Maya & Leo Sunset Rooftop Engagement',
    type: 'anniversary' as const,
    eventDate: '2027-09-15T18:00:00.000Z',
    guestCount: 65,
    location: 'Brooklyn, NY',
    description: 'An elegant golden-hour rooftop party with warm jazz notes and seasonal drinks.',
    budget: {
      currency: 'USD' as const,
      totalBudget: 15000,
      items: [],
    },
  };

  it('allows unauthenticated guest to generate a celebration plan', async () => {
    const res = await request(app)
      .post('/api/events/guest-plan')
      .send(validGuestPlanInput);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const plan = res.body.data;

    expect(plan.id).toBeDefined();
    expect(plan.id.startsWith('draft-')).toBe(true);
    expect(plan.ownerId).toBe('guest');
    expect(plan.status).toBe('draft');
    expect(plan.title).toBe(validGuestPlanInput.title);
    expect(plan.type).toBe('anniversary');
    expect(plan.guestCount).toBe(65);
    expect(plan.location).toBe('Brooklyn, NY');

    // Generated content
    expect(Array.isArray(plan.ideas)).toBe(true);
    expect(plan.ideas.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(plan.budget.items)).toBe(true);
    expect(plan.budget.items.length).toBeGreaterThanOrEqual(1);
    expect(plan.budget.totalBudget).toBe(15000);

    expect(Array.isArray(plan.timeline)).toBe(true);
    expect(plan.timeline.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(plan.vendors)).toBe(true);
    expect(plan.vendors.length).toBeGreaterThanOrEqual(1);

    // Verify nothing was persisted to database yet
    const allSavedEvents = await eventStore.findAll('guest');
    expect(allSavedEvents.length).toBe(0);
  });

  it('rejects invalid guest plan payload with 400', async () => {
    const res = await request(app)
      .post('/api/events/guest-plan')
      .send({
        title: '', // invalid
        type: 'invalid-type',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('allows unauthenticated guest to query the AI assistant on their plan', async () => {
    // First generate guest plan
    const planRes = await request(app)
      .post('/api/events/guest-plan')
      .send(validGuestPlanInput);
    const guestPlan = planRes.body.data;

    const assistRes = await request(app)
      .post('/api/events/guest-ai-assist')
      .send({
        event: guestPlan,
        prompt: 'How can we cut venue costs by 10%?',
        contextType: 'budget',
      });

    expect(assistRes.status).toBe(200);
    expect(assistRes.body.success).toBe(true);
    expect(assistRes.body.data.response).toBeDefined();
    expect(typeof assistRes.body.data.response).toBe('string');
  });

  it('rejects unauthenticated attempts to save guest plan with 401', async () => {
    const res = await request(app)
      .post('/api/events/save-guest-plan')
      .send({
        draftId: 'draft-12345',
        title: 'Unauthorized Save Attempt',
        type: 'birthday',
        eventDate: '2027-10-10T12:00:00.000Z',
        location: 'Miami, FL',
        guestCount: 30,
        budget: { totalBudget: 5000, currency: 'USD', items: [] },
        timeline: [],
        vendors: [],
        ideas: [],
      });

    expect(res.status).toBe(401);
  });

  it('saves guest plan to authenticated account, deriving ownerId strictly from server session', async () => {
    // 1. Generate guest plan
    const planRes = await request(app)
      .post('/api/events/guest-plan')
      .send(validGuestPlanInput);
    const guestPlan = planRes.body.data;

    // 2. Add custom budget item and edited milestone while in guest mode
    const customItemId = crypto.randomUUID();
    guestPlan.budget.items.push({
      id: customItemId,
      category: 'decor',
      estimatedAmount: 600,
      actualAmount: 550,
      isPaid: true,
      notes: 'Handmade organic cotton',
    });

    // 3. User authenticates and clicks "Save My Plan"
    // Client tries to send an arbitrary client-side ownerId spoof
    const payloadWithSpoofedOwner = {
      draftId: guestPlan.id,
      title: guestPlan.title,
      type: guestPlan.type,
      eventDate: guestPlan.eventDate,
      location: guestPlan.location,
      guestCount: guestPlan.guestCount,
      description: guestPlan.description,
      budget: guestPlan.budget,
      timeline: guestPlan.timeline,
      vendors: guestPlan.vendors,
      ideas: guestPlan.ideas,
      ownerId: 'spoofed-attacker-user-id', // MUST be ignored by server
    };

    const saveRes = await request(app)
      .post('/api/events/save-guest-plan')
      .set(authHeader)
      .send(payloadWithSpoofedOwner);

    expect(saveRes.status).toBe(201);
    expect(saveRes.body.success).toBe(true);
    const savedEvent = saveRes.body.data;

    // Owner ID derived from authenticated user session, NOT spoofed id or 'guest'
    expect(savedEvent.ownerId).toBe('user-test-guest-owner');
    expect(savedEvent.ownerId).not.toBe('spoofed-attacker-user-id');
    expect(savedEvent.ownerId).not.toBe('guest');

    // Generated ID is a persistent event ID, not draft-
    expect(savedEvent.id.startsWith('draft-')).toBe(false);
    expect(savedEvent.status).toBe('planning');

    // Preserved custom items and generated resources
    const customFound = savedEvent.budget.items.find(
      (b: any) => b.id === customItemId
    );
    expect(customFound).toBeDefined();
    expect(customFound.estimatedAmount).toBe(600);

    // Persisted in database
    const dbEvent = await eventStore.findById(savedEvent.id, 'user-test-guest-owner');
    expect(dbEvent).not.toBeNull();
    expect(dbEvent!.title).toBe(validGuestPlanInput.title);
  });

  it('prevents duplicate event creation if save is retried with same draftId', async () => {
    const draftId = `draft-idempotent-${Date.now()}`;
    const payload = {
      draftId,
      title: 'Idempotency Test Celebration',
      type: 'birthday' as const,
      eventDate: '2027-11-20T19:00:00.000Z',
      location: 'Chicago, IL',
      guestCount: 20,
      budget: { totalBudget: 4000, currency: 'USD' as const, items: [] },
      timeline: [],
      vendors: [],
      ideas: [],
    };

    // First save
    const firstRes = await request(app)
      .post('/api/events/save-guest-plan')
      .set(authHeader)
      .send(payload);
    expect(firstRes.status).toBe(201);
    const firstSaved = firstRes.body.data;

    // Second save (simulating retry or double-click)
    const secondRes = await request(app)
      .post('/api/events/save-guest-plan')
      .set(authHeader)
      .send(payload);
    expect(secondRes.status).toBe(200); // 200 returned for existing idempotent save
    expect(secondRes.body.data.id).toBe(firstSaved.id);

    // Verify only ONE event exists in the store
    const userEvents = await eventStore.findAll('user-test-guest-owner');
    const matched = userEvents.filter((e) => e.title === 'Idempotency Test Celebration');
    expect(matched.length).toBe(1);
  });

  it('ensures guests cannot access private saved events of other users', async () => {
    // Create an authenticated event
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send({
        title: 'Private Authenticated Wedding',
        type: 'wedding',
        eventDate: '2027-08-01T15:00:00.000Z',
        location: 'San Francisco, CA',
        guestCount: 150,
        budget: { totalBudget: 50000, currency: 'USD', items: [] },
      });
    const privateEventId = createRes.body.data.id;

    // Guest tries to get event without auth
    const getRes = await request(app).get(`/api/events/${privateEventId}`);
    expect(getRes.status).toBe(401);

    // Guest tries to list events without auth
    const listRes = await request(app).get('/api/events');
    expect(listRes.status).toBe(401);

    // Guest tries to delete event without auth
    const deleteRes = await request(app).delete(`/api/events/${privateEventId}`);
    expect(deleteRes.status).toBe(401);

    // Guest tries to update event without auth
    const updateRes = await request(app)
      .patch(`/api/events/${privateEventId}`)
      .send({ title: 'Hacked Title' });
    expect(updateRes.status).toBe(401);
  });

  it('enforces stricter abuse controls and rate limits on unauthenticated guest AI generation', async () => {
    // Make 10 requests with x-test-rate-limit header
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post('/api/events/guest-plan')
        .set('x-test-rate-limit', '1')
        .send(validGuestPlanInput);
      expect([200, 429]).toContain(res.status);
    }

    // 11th request must be rejected with 429
    const blockedRes = await request(app)
      .post('/api/events/guest-plan')
      .set('x-test-rate-limit', '1')
      .send(validGuestPlanInput);

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blockedRes.header['retry-after']).toBeDefined();
  });
});
