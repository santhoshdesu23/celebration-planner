import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'node:crypto';
import { createApp } from '../src/createApp.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiService, aiCircuitBreaker } from '../src/services/aiService.js';
import { EventModel } from '../src/models/Event.model.js';
import type { Event as EventType } from '@celebration-planner/shared';

describe('Efficiency & Performance Suite', () => {
  const app = createApp();

  beforeEach(async () => {
    await eventStore.clear();
    aiCircuitBreaker.resetForTest();
  });

  describe('MongoDB Index Definitions', () => {
    it('declares compound indexes for owner-scoped sorts, filters, and AI recovery sweeps', () => {
      const indexes = EventModel.schema.indexes();

      // Check for compound index: { ownerId: 1, createdAt: -1 }
      const hasOwnerCreatedAt = indexes.some(
        ([fields]) => fields.ownerId === 1 && fields.createdAt === -1
      );
      expect(hasOwnerCreatedAt).toBe(true);

      // Check for compound index: { id: 1, ownerId: 1 }
      const hasIdOwner = indexes.some(
        ([fields]) => fields.id === 1 && fields.ownerId === 1
      );
      expect(hasIdOwner).toBe(true);

      // Check for compound index: { ownerId: 1, type: 1, createdAt: -1 }
      const hasOwnerTypeCreated = indexes.some(
        ([fields]) => fields.ownerId === 1 && fields.type === 1 && fields.createdAt === -1
      );
      expect(hasOwnerTypeCreated).toBe(true);

      // Check for compound index: { ownerId: 1, status: 1, createdAt: -1 }
      const hasOwnerStatusCreated = indexes.some(
        ([fields]) => fields.ownerId === 1 && fields.status === 1 && fields.createdAt === -1
      );
      expect(hasOwnerStatusCreated).toBe(true);

      // Check for recovery sweep compound index: { aiPlanStatus: 1, aiPlanStartedAt: 1, aiPlanRetryCount: 1 }
      const hasSweeperIndex = indexes.some(
        ([fields]) =>
          fields.aiPlanStatus === 1 &&
          fields.aiPlanStartedAt === 1 &&
          fields.aiPlanRetryCount === 1
      );
      expect(hasSweeperIndex).toBe(true);
    });
  });

  describe('Targeted AI Status Polling Optimization', () => {
    it('retrieves only minimal status fields via findAiStatus without large arrays', async () => {
      const ownerId = 'test-owner-status';
      const eventId = crypto.randomUUID();

      const sampleEvent: EventType = {
        id: eventId,
        ownerId,
        title: 'Anniversary Banquet',
        type: 'anniversary',
        eventDate: '2026-11-20',
        guestCount: 80,
        location: 'Rooftop Lounge',
        description: 'Golden anniversary with sunset views.',
        status: 'planning',
        budget: {
          currency: 'USD',
          totalBudget: 15000,
          items: [
            { id: crypto.randomUUID(), category: 'Venue', estimatedAmount: 5000, isPaid: true },
            { id: crypto.randomUUID(), category: 'Catering', estimatedAmount: 6000, isPaid: false },
          ],
        },
        timeline: [
          { id: crypto.randomUUID(), title: 'Select Menu', dueDate: '2026-10-01', isCompleted: true },
          { id: crypto.randomUUID(), title: 'Send Invites', dueDate: '2026-10-15', isCompleted: false },
        ],
        vendors: [
          { id: crypto.randomUUID(), name: 'Sunset Catering', category: 'Catering', status: 'booked', isAiSuggested: true },
        ],
        ideas: [
          { id: crypto.randomUUID(), category: 'Theme', title: 'Golden Sunset', description: 'Warm amber tones', tags: ['Gold'] },
        ],
        aiSuggestionsGenerated: true,
        aiPlanStatus: 'completed',
        aiPlanStartedAt: '2026-09-01T10:00:00.000Z',
        aiPlanCompletedAt: '2026-09-01T10:00:03.000Z',
        aiPlanError: null,
        aiPlanRetryCount: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await eventStore.create(sampleEvent);

      const status = await eventStore.findAiStatus(eventId, ownerId);
      expect(status).not.toBeNull();
      expect(status!.eventId).toBe(eventId);
      expect(status!.aiPlanStatus).toBe('completed');
      expect(status!.aiPlanStartedAt).toBe('2026-09-01T10:00:00.000Z');
      expect(status!.aiPlanCompletedAt).toBe('2026-09-01T10:00:03.000Z');
      expect(status!.aiPlanError).toBeNull();
      expect(status!.aiPlanRetryCount).toBe(1);

      // Verify that bloated arrays are NOT present on the status payload
      expect((status as any).ideas).toBeUndefined();
      expect((status as any).timeline).toBeUndefined();
      expect((status as any).vendors).toBeUndefined();
      expect((status as any).budget).toBeUndefined();
    });
  });

  describe('Event Listing Payload Projection & Pagination', () => {
    it('projects lightweight summary when summary=true, reducing payload size significantly', async () => {
      const ownerId = 'test-owner-summary';

      // Create 10 rich events with nested arrays
      for (let i = 0; i < 10; i++) {
        const event: EventType = {
          id: crypto.randomUUID(),
          ownerId,
          title: `Celebration ${i + 1}`,
          type: 'birthday',
          eventDate: '2026-12-01',
          guestCount: 50,
          location: 'Celebration Hall',
          description: 'A celebration with delicious banquet dining and live entertainment.',
          status: 'confirmed',
          budget: {
            currency: 'USD',
            totalBudget: 10000,
            items: [
              { id: crypto.randomUUID(), category: 'Hall', estimatedAmount: 3000, isPaid: true },
              { id: crypto.randomUUID(), category: 'Food', estimatedAmount: 4000, isPaid: false },
              { id: crypto.randomUUID(), category: 'Music', estimatedAmount: 2000, isPaid: false },
            ],
          },
          timeline: [
            { id: crypto.randomUUID(), title: 'Book Hall', dueDate: '2026-10-01', isCompleted: true },
            { id: crypto.randomUUID(), title: 'Send Invites', dueDate: '2026-10-15', isCompleted: true },
            { id: crypto.randomUUID(), title: 'Order Cake', dueDate: '2026-11-01', isCompleted: false },
          ],
          vendors: [
            { id: crypto.randomUUID(), name: 'Party Hall', category: 'Venue', status: 'booked', isAiSuggested: true },
            { id: crypto.randomUUID(), name: 'DJ Sound', category: 'Music', status: 'contacted', isAiSuggested: true },
          ],
          ideas: [
            { id: crypto.randomUUID(), category: 'Theme', title: 'Neon Disco', description: 'Retro neon lighting', tags: ['Neon'] },
            { id: crypto.randomUUID(), category: 'Fun', title: 'Karaoke Hour', description: 'Singing with guests', tags: ['Karaoke'] },
          ],
          aiSuggestionsGenerated: true,
          aiPlanStatus: 'completed',
          aiPlanStartedAt: new Date().toISOString(),
          aiPlanCompletedAt: new Date().toISOString(),
          aiPlanError: null,
          aiPlanRetryCount: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        await eventStore.create(event);
      }

      // Fetch full events
      const fullEvents = await eventStore.findAll(ownerId);
      const fullSize = Buffer.byteLength(JSON.stringify(fullEvents), 'utf8');

      // Fetch summary events
      const summaryEvents = await eventStore.findAll(ownerId, { summary: true });
      const summarySize = Buffer.byteLength(JSON.stringify(summaryEvents), 'utf8');

      expect(summaryEvents).toHaveLength(10);
      expect(summarySize).toBeLessThan(fullSize * 0.6); // Over 50% reduction for small events, >75% for full plans

      // Check that summary events omit heavy arrays
      expect(summaryEvents[0].ideas).toHaveLength(0);
      expect(summaryEvents[0].vendors).toHaveLength(0);
      expect(summaryEvents[0].budget.items).toHaveLength(0);
      // But retain card metadata
      expect(summaryEvents[0].title).toBeDefined();
      expect(summaryEvents[0].budget.totalBudget).toBe(10000);
      expect(summaryEvents[0].budget.currency).toBe('USD');
      expect(summaryEvents[0].timeline).toBeDefined();
    });

    it('honors pagination limit and skip parameters', async () => {
      const ownerId = 'test-owner-paging';
      for (let i = 0; i < 5; i++) {
        await eventStore.create({
          id: `item-${i}`,
          ownerId,
          title: `Event ${i}`,
          type: 'corporate',
          eventDate: '2026-12-10',
          guestCount: 20,
          location: 'Conference Room',
          status: 'planning',
          budget: { currency: 'USD', totalBudget: 2000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
          aiSuggestionsGenerated: false,
          aiPlanStatus: 'completed',
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      const page1 = await eventStore.findAll(ownerId, { limit: 2, skip: 0 });
      expect(page1).toHaveLength(2);
      expect(page1[0].id).toBe('item-0');
      expect(page1[1].id).toBe('item-1');

      const page2 = await eventStore.findAll(ownerId, { limit: 2, skip: 2 });
      expect(page2).toHaveLength(2);
      expect(page2[0].id).toBe('item-2');
      expect(page2[1].id).toBe('item-3');

      const page3 = await eventStore.findAll(ownerId, { limit: 2, skip: 4 });
      expect(page3).toHaveLength(1);
      expect(page3[0].id).toBe('item-4');
    });
  });

  describe('AI Circuit Breaker & Fallback Acceleration', () => {
    it('trips immediately on non-recoverable error and avoids 10s timeouts', async () => {
      expect(aiCircuitBreaker.isOpen()).toBe(false);

      // Record a 404 (model not found / deprecated) failure
      aiCircuitBreaker.recordFailure(new Error('GoogleGenerativeAI: 404 Not Found'));
      expect(aiCircuitBreaker.isOpen()).toBe(true);

      const start = performance.now();
      const plan = await aiService.generateEventPlan({
        title: 'Speed Test Event',
        type: 'wedding',
        eventDate: '2026-10-30',
        guestCount: 100,
        location: 'Grand Plaza',
        budget: { currency: 'USD', totalBudget: 10000, items: [] },
      });
      const duration = performance.now() - start;

      // Plan is returned immediately by circuit-breaker domain fallback in <50ms instead of 12,000ms
      expect(duration).toBeLessThan(100);
      expect(plan.ideas.length).toBeGreaterThanOrEqual(4);
      expect(plan.timeline.length).toBeGreaterThanOrEqual(6);
      expect(plan.vendors.length).toBeGreaterThanOrEqual(4);
    });

    it('resets circuit breaker state when resetForTest is called', () => {
      aiCircuitBreaker.recordFailure(new Error('404 Model Not Found'));
      expect(aiCircuitBreaker.isOpen()).toBe(true);

      aiCircuitBreaker.resetForTest();
      expect(aiCircuitBreaker.isOpen()).toBe(false);
    });
  });
});
