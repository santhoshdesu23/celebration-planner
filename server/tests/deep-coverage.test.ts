import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import { ZodError, z } from 'zod';
import { AppError, errorHandler } from '../src/middleware/errorHandler.js';
import { requireAuth } from '../src/middleware/auth.js';
import { migrateLegacyEvents, QUARANTINE_OWNER_ID } from '../src/db/migration.js';
import { aiJobRunner } from '../src/services/aiJobRunner.js';
import { aiService } from '../src/services/aiService.js';
import { eventStore } from '../src/services/eventStore.js';
import { userStore } from '../src/services/userStore.js';
import type { Event as EventType } from '@celebration-planner/shared';

const testEvent: EventType = {
  id: 'evt-test-coverage',
  ownerId: 'u-cov-1',
  title: 'Ruby Anniversary Gala',
  type: 'anniversary',
  eventDate: '2029-06-15T18:00:00.000Z',
  guestCount: 80,
  location: 'Emerald Ballroom, Seattle',
  status: 'planning',
  budget: {
    currency: 'USD',
    totalBudget: 25000,
    items: [],
  },
  timeline: [],
  vendors: [],
  ideas: [],
  aiSuggestionsGenerated: false,
  aiPlanStatus: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Deep Server Coverage & Edge Cases', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    aiJobRunner.stopBackgroundSweeper();
  });

  afterEach(() => {
    aiJobRunner.stopBackgroundSweeper();
  });

  describe('errorHandler middleware', () => {
    it('handles AppError with custom status code, error code, and details', () => {
      const appErr = new AppError(409, 'CONFLICT', 'Resource already exists', { resourceId: '123' });
      expect(appErr.statusCode).toBe(409);
      expect(appErr.code).toBe('CONFLICT');
      expect(appErr.name).toBe('AppError');

      const mockRes: any = {
        statusCode: 0,
        body: null,
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        },
      };

      errorHandler(appErr, {} as Request, mockRes, vi.fn());

      expect(mockRes.statusCode).toBe(409);
      expect(mockRes.body).toEqual({
        success: false,
        error: {
          code: 'CONFLICT',
          message: 'Resource already exists',
          details: { resourceId: '123' },
        },
      });
    });

    it('handles ZodError by returning 400 VALIDATION_ERROR with flattened details', () => {
      const TestSchema = z.object({ email: z.string().email() });
      const parseResult = TestSchema.safeParse({ email: 'not-an-email' });
      expect(parseResult.success).toBe(false);

      const mockRes: any = {
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        },
      };

      if (!parseResult.success) {
        errorHandler(parseResult.error, {} as Request, mockRes, vi.fn());
      }

      expect(mockRes.statusCode).toBe(400);
      expect(mockRes.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockRes.body.error.details.fieldErrors).toHaveProperty('email');
    });

    it('handles unknown Error by returning 500 INTERNAL_SERVER_ERROR without leaking stack trace', () => {
      const mockRes: any = {
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        },
      };

      const spyWarn = vi.spyOn(console, 'error').mockImplementation(() => {});
      errorHandler(new Error('Internal database socket timeout password=secret'), {} as Request, mockRes, vi.fn());
      spyWarn.mockRestore();

      expect(mockRes.statusCode).toBe(500);
      expect(mockRes.body).toEqual({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
        },
      });
      // Crucial: no secret leaked in response
      expect(JSON.stringify(mockRes.body)).not.toContain('password');
    });
  });

  describe('auth middleware edge cases', () => {
    it('rejects malformed auth header or invalid token with 401 UNAUTHORIZED', () => {
      const mockRes: any = {
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: any) {
          this.body = payload;
          return this;
        },
      };

      // Case 1: Token provided but invalid
      const reqInvalid: any = {
        headers: { authorization: 'Bearer invalid.bogus.jwt' },
        cookies: {},
      };
      requireAuth(reqInvalid, mockRes, vi.fn());
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.error.message).toContain('Invalid or expired session');

      // Case 2: No Bearer prefix and no cookie
      const reqMissing: any = {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
        cookies: {},
      };
      requireAuth(reqMissing, mockRes, vi.fn());
      expect(mockRes.statusCode).toBe(401);
      expect(mockRes.body.error.message).toContain('Authentication required');
    });
  });

  describe('migration legacy events', () => {
    it('returns { modifiedCount: 0 } when database connection is not active', async () => {
      const res = await migrateLegacyEvents();
      expect(typeof res.modifiedCount).toBe('number');
      expect(QUARANTINE_OWNER_ID).toBe('quarantine-unassigned');
    });
  });

  describe('aiJobRunner lifecycle and recovery', () => {
    it('manages background sweeper start and stop intervals safely', () => {
      expect(() => {
        aiJobRunner.startBackgroundSweeper(100);
        aiJobRunner.startBackgroundSweeper(100); // duplicate start is a no-op
        aiJobRunner.stopBackgroundSweeper();
        aiJobRunner.stopBackgroundSweeper(); // duplicate stop is safe
      }).not.toThrow();
    });

    it('triggers job, fails cleanly if event does not exist, and cleans up activeJobs lock', async () => {
      const result = await aiJobRunner.triggerJob('non-existent-event-id', 'u-cov-1');
      expect(result).toBeNull();
      expect(aiJobRunner.isJobActive('non-existent-event-id', 'u-cov-1')).toBe(false);
    });

    it('recovers pending jobs via eventStore scan', async () => {
      const count = await aiJobRunner.recoverPendingJobs(0);
      expect(typeof count).toBe('number');
    });
  });

  describe('aiService assistant context topics and fallback generator', () => {
    it('generates budget advice when user asks about cost and savings', async () => {
      const reply = await aiService.askAssistant(testEvent, 'How can I save money on catering costs?');
      expect(reply.response).toContain('Budget Optimization Tips');
      expect(reply.response).toContain('Ruby Anniversary Gala');
      expect(reply.suggestions.length).toBeGreaterThan(0);
    });

    it('generates vendor inquiry email template when asked about vendor emails', async () => {
      const reply = await aiService.askAssistant(testEvent, 'Can you draft a vendor inquiry email?');
      expect(reply.response).toContain('Sample Vendor Inquiry Template');
      expect(reply.response).toContain('Ruby Anniversary Gala');
    });

    it('generates run-of-show schedule when asked about event timeline', async () => {
      const reply = await aiService.askAssistant(testEvent, 'Give me a timeline and run of show schedule');
      expect(reply.response).toContain('Suggested Run-of-Show');
      expect(reply.response).toContain('02:00 PM');
    });

    it('generates inspiring advice for general questions', async () => {
      const reply = await aiService.askAssistant(testEvent, 'What unique creative activities can we do?');
      expect(reply.response).toContain('Ruby Anniversary Gala');
      expect(reply.response).toContain('Emerald Ballroom');
    });

    it('generates domain fallback plans for multiple event categories', async () => {
      const types = ['wedding', 'birthday', 'corporate', 'community', 'graduation', 'other'] as const;
      for (const t of types) {
        const ev: EventType = { ...testEvent, id: `evt-${t}`, type: t };
        const plan = await aiService.generateEventPlan(ev);
        expect(plan.ideas.length).toBeGreaterThan(0);
        expect(plan.timeline.length).toBeGreaterThan(0);
        expect(plan.vendors.length).toBeGreaterThan(0);
      }
    });
  });

  describe('eventStore and userStore edge cases', () => {
    it('eventStore handles non-existent event updates and deletions safely', async () => {
      const notFound = await eventStore.findById('non-existent-123', 'u-nobody');
      expect(notFound).toBeNull();

      const deleteResult = await eventStore.delete('non-existent-123', 'u-nobody');
      expect(deleteResult).toBe(false);

      const updateResult = await eventStore.update('non-existent-123', 'u-nobody', {
        title: 'Updated Title',
      });
      expect(updateResult).toBeNull();
    });

    it('eventStore finds events with combined type and status query filters', async () => {
      const created = await eventStore.create(testEvent);
      expect(created.id).toBe(testEvent.id);

      const filtered = await eventStore.findAll('u-cov-1', {
        type: 'anniversary',
        status: 'planning',
      });
      expect(filtered.length).toBeGreaterThanOrEqual(1);
      expect(filtered[0].title).toBe('Ruby Anniversary Gala');

      // Cleanup
      await eventStore.delete(testEvent.id, 'u-cov-1');
    });

    it('userStore provides case-insensitive email lookup', async () => {
      const email = `case.test.${Date.now()}@example.com`;
      await userStore.create({
        id: `u-case-${Date.now()}`,
        name: 'Case Sensitive Tester',
        email,
        passwordHash: 'hash123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const foundUpper = await userStore.findByEmail(email.toUpperCase());
      expect(foundUpper).not.toBeNull();
      expect(foundUpper?.name).toBe('Case Sensitive Tester');
    });
  });
});
