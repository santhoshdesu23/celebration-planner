import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { EventQueryFilterSchema, QueryBooleanSchema } from '@celebration-planner/shared';
import { createApp } from '../src/createApp.js';
import { eventStore } from '../src/services/eventStore.js';
import { getTestAuthHeader } from './helpers/authHelper.js';
import type { Event as EventType } from '@celebration-planner/shared';

describe('QueryBooleanSchema & EventQueryFilterSchema', () => {
  describe('QueryBooleanSchema unit behavior', () => {
    it.each([
      ['string "false"', 'false', false],
      ['string "0"', '0', false],
      ['boolean false', false, false],
      ['string "true"', 'true', true],
      ['string "1"', '1', true],
      ['boolean true', true, true],
      ['undefined', undefined, undefined],
      ['empty string', '', undefined],
    ])('correctly parses %s (%j) to %j', (_label, input, expected) => {
      const parsed = QueryBooleanSchema.parse(input);
      expect(parsed).toBe(expected);
    });

    it('rejects invalid boolean strings', () => {
      expect(() => QueryBooleanSchema.parse('invalid')).toThrow();
      expect(() => QueryBooleanSchema.parse('yes')).toThrow();
    });
  });

  describe('EventQueryFilterSchema behavior', () => {
    it('parses ?summary=false as summary: false', () => {
      const result = EventQueryFilterSchema.parse({ summary: 'false' });
      expect(result.summary).toBe(false);
    });

    it('parses ?summary=true as summary: true', () => {
      const result = EventQueryFilterSchema.parse({ summary: 'true' });
      expect(result.summary).toBe(true);
    });

    it('leaves summary undefined when omitted', () => {
      const result = EventQueryFilterSchema.parse({});
      expect(result.summary).toBeUndefined();
    });
  });

  describe('GET /api/events integration with ?summary parameter', () => {
    const app = createApp();
    const ownerId = '00000000-0000-0000-0000-000000000001';
    const authHeader = getTestAuthHeader({ id: ownerId, email: 'tester@example.com', name: 'Test User' });

    beforeEach(async () => {
      await eventStore.clear();
    });

    it('returns full representation when summary=false and stripped arrays when summary=true', async () => {
      const testEvent: EventType = {
        id: crypto.randomUUID(),
        ownerId,
        title: 'Full Representation Test',
        type: 'birthday',
        eventDate: '2028-01-01T18:00:00.000Z',
        guestCount: 30,
        location: 'Garden Lounge',
        description: 'Test description',
        status: 'planning',
        budget: {
          currency: 'USD',
          totalBudget: 5000,
          items: [{ id: crypto.randomUUID(), category: 'Cake', estimatedAmount: 200, isPaid: true }],
        },
        timeline: [{ id: crypto.randomUUID(), title: 'Bake Cake', dueDate: '2027-12-30', isCompleted: false }],
        vendors: [{ id: crypto.randomUUID(), name: 'Sweet Bakery', category: 'Bakery', status: 'booked', isAiSuggested: false }],
        ideas: [{ id: crypto.randomUUID(), category: 'Dessert', title: 'Cupcake Tower', description: 'Tower of cupcakes', tags: ['Cake'] }],
        aiSuggestionsGenerated: true,
        aiPlanStatus: 'completed',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await eventStore.create(testEvent);

      // 1. GET /api/events?summary=false -> must return full arrays
      const resFull = await request(app)
        .get(`/api/events?summary=false`)
        .set(authHeader);

      expect(resFull.status).toBe(200);
      expect(resFull.body.data).toHaveLength(1);
      const fullEvent = resFull.body.data[0];
      expect(fullEvent.ideas).toHaveLength(1);
      expect(fullEvent.vendors).toHaveLength(1);
      expect(fullEvent.budget.items).toHaveLength(1);

      // 2. GET /api/events?summary=true -> must return lightweight summary with stripped arrays
      const resSummary = await request(app)
        .get(`/api/events?summary=true`)
        .set(authHeader);

      expect(resSummary.status).toBe(200);
      expect(resSummary.body.data).toHaveLength(1);
      const summaryEvent = resSummary.body.data[0];
      expect(summaryEvent.ideas).toEqual([]);
      expect(summaryEvent.vendors).toEqual([]);
      expect(summaryEvent.budget.items).toEqual([]);
      expect(summaryEvent.title).toBe('Full Representation Test');

      // 3. GET /api/events?summary=invalid -> rejects with 400 Bad Request
      const resInvalid = await request(app)
        .get(`/api/events?summary=not-a-boolean`)
        .set(authHeader);

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.success).toBe(false);
    });
  });
});
