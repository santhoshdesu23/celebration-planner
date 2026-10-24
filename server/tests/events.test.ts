import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiJobRunner } from '../src/services/aiJobRunner.js';
import { getTestAuthHeader } from './helpers/authHelper.js';

const app = createApp();
const authHeader = getTestAuthHeader();

describe('Events API (/api/events)', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  const validEventInput = {
    title: 'Aria & Liam Golden Wedding',
    type: 'wedding',
    eventDate: '2027-06-18T16:00:00.000Z',
    guestCount: 120,
    location: 'Napa Valley, CA',
    description: 'An outdoor vineyard ceremony with warm gold accents and live acoustic music',
    budget: {
      currency: 'USD',
      totalBudget: 35000,
      items: [],
    },
  };

  it('rejects invalid event payload with 400', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates an event with AI-generated ideas, budget breakdown, timeline, and vendors', async () => {
    const res = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const event = res.body.data;
    expect(event.id).toBeDefined();
    expect(event.ownerId).toBeDefined();
    expect(event.title).toBe(validEventInput.title);
    expect(event.type).toBe('wedding');
    expect(event.status).toBe('planning');
    expect(['pending', 'processing']).toContain(event.aiPlanStatus);

    // Await async background AI generation
    const completedEvent = await aiJobRunner.waitForJob(event.id, event.ownerId);
    expect(completedEvent).not.toBeNull();
    expect(completedEvent!.aiSuggestionsGenerated).toBe(true);
    expect(completedEvent!.aiPlanStatus).toBe('completed');

    // Verify AI generated content
    expect(Array.isArray(completedEvent!.ideas)).toBe(true);
    expect(completedEvent!.ideas.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(completedEvent!.budget.items)).toBe(true);
    expect(completedEvent!.budget.items.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(completedEvent!.timeline)).toBe(true);
    expect(completedEvent!.timeline.length).toBeGreaterThanOrEqual(1);

    expect(Array.isArray(completedEvent!.vendors)).toBe(true);
    expect(completedEvent!.vendors.length).toBeGreaterThanOrEqual(1);
  });

  it('lists created events', async () => {
    await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);

    const res = await request(app)
      .get('/api/events')
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].title).toBe(validEventInput.title);
  });

  it('retrieves single event by ID', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const eventId = createRes.body.data.id;

    const res = await request(app)
      .get(`/api/events/${eventId}`)
      .set(authHeader);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(eventId);
  });

  it('returns 404 for non-existent event', async () => {
    const res = await request(app)
      .get('/api/events/non-existent-id')
      .set(authHeader);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('updates event title and status', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const eventId = createRes.body.data.id;

    const res = await request(app)
      .patch(`/api/events/${eventId}`)
      .set(authHeader)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');
  });

  it('manages budget items (add, update, delete)', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const eventId = createRes.body.data.id;

    // Add budget item
    const addRes = await request(app)
      .post(`/api/events/${eventId}/budget/items`)
      .set(authHeader)
      .send({
        category: 'Custom Ice Sculpture',
        estimatedAmount: 750,
        actualAmount: 700,
        notes: 'Two-tier swan design',
        isPaid: false,
      });

    expect(addRes.status).toBe(201);
    const updatedEvent = addRes.body.data;
    const addedItem = updatedEvent.budget.items.find(
      (i: any) => i.category === 'Custom Ice Sculpture'
    );
    expect(addedItem).toBeDefined();
    expect(addedItem.estimatedAmount).toBe(750);

    // Update budget item to paid
    const updateRes = await request(app)
      .patch(`/api/events/${eventId}/budget/items/${addedItem.id}`)
      .set(authHeader)
      .send({ isPaid: true, actualAmount: 720 });

    expect(updateRes.status).toBe(200);
    const patchedItem = updateRes.body.data.budget.items.find(
      (i: any) => i.id === addedItem.id
    );
    expect(patchedItem.isPaid).toBe(true);
    expect(patchedItem.actualAmount).toBe(720);

    // Delete budget item
    const deleteRes = await request(app)
      .delete(`/api/events/${eventId}/budget/items/${addedItem.id}`)
      .set(authHeader);
    expect(deleteRes.status).toBe(200);
    const finalItems = deleteRes.body.data.budget.items;
    expect(finalItems.find((i: any) => i.id === addedItem.id)).toBeUndefined();
  });

  it('updates milestone completion status', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const event = createRes.body.data;
    const completedEvent = await aiJobRunner.waitForJob(event.id, event.ownerId);
    const milestone = completedEvent!.timeline[0];

    const patchRes = await request(app)
      .patch(`/api/events/${event.id}/timeline/items/${milestone.id}`)
      .set(authHeader)
      .send({ isCompleted: true });

    expect(patchRes.status).toBe(200);
    const updatedMilestone = patchRes.body.data.timeline.find(
      (t: any) => t.id === milestone.id
    );
    expect(updatedMilestone.isCompleted).toBe(true);
  });

  it('updates vendor booking status', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const event = createRes.body.data;
    const completedEvent = await aiJobRunner.waitForJob(event.id, event.ownerId);
    const vendor = completedEvent!.vendors[0];

    const patchRes = await request(app)
      .patch(`/api/events/${event.id}/vendors/${vendor.id}`)
      .set(authHeader)
      .send({ status: 'booked', confirmedCost: 4500 });

    expect(patchRes.status).toBe(200);
    const updatedVendor = patchRes.body.data.vendors.find(
      (v: any) => v.id === vendor.id
    );
    expect(updatedVendor.status).toBe('booked');
    expect(updatedVendor.confirmedCost).toBe(4500);
  });

  it('provides AI assistant advice and tips', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const eventId = createRes.body.data.id;

    const assistRes = await request(app)
      .post(`/api/events/${eventId}/ai-assist`)
      .set(authHeader)
      .send({
        prompt: 'How can we save 15% on catering for our 120 guests?',
        contextType: 'budget',
      });

    expect(assistRes.status).toBe(200);
    expect(assistRes.body.success).toBe(true);
    expect(typeof assistRes.body.data.response).toBe('string');
    expect(assistRes.body.data.response.length).toBeGreaterThan(20);
  });

  it('deletes an event successfully', async () => {
    const createRes = await request(app)
      .post('/api/events')
      .set(authHeader)
      .send(validEventInput);
    const eventId = createRes.body.data.id;

    const delRes = await request(app)
      .delete(`/api/events/${eventId}`)
      .set(authHeader);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.deleted).toBe(true);

    const getRes = await request(app)
      .get(`/api/events/${eventId}`)
      .set(authHeader);
    expect(getRes.status).toBe(404);
  });
});
