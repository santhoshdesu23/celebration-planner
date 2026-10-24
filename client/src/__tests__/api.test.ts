import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { api, ApiError } from '../lib/api';

describe('Client API Layer (api.ts)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    api.setCsrfToken(null);
    // Clear cookies in jsdom
    document.cookie.split(';').forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('ApiError', () => {
    it('creates an error instance with message, status, and code', () => {
      const error = new ApiError('Not authorized', 401, 'AUTH_ERROR');
      expect(error.message).toBe('Not authorized');
      expect(error.status).toBe(401);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.name).toBe('ApiError');
    });
  });

  describe('CSRF Token Handling & Double-Submit Headers', () => {
    it('reads csrf_token from cookie when in-memory token is unset', () => {
      document.cookie = 'csrf_token=cookie-csrf-token-123;path=/';
      expect(api.getCsrfToken()).toBe('cookie-csrf-token-123');
    });

    it('attaches X-Requested-With and X-CSRF-Token to mutation requests', async () => {
      api.setCsrfToken('active-token-456');

      let capturedHeaders: Record<string, string> = {};
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedHeaders = options?.headers || {};
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { id: 'evt-1' } }),
        };
      });

      await api.deleteEvent('evt-1');

      expect(capturedHeaders['X-Requested-With']).toBe('XMLHttpRequest');
      expect(capturedHeaders['X-CSRF-Token']).toBe('active-token-456');
    });

    it('retries request once if 403 CSRF_ERROR occurs by refreshing token', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(async (url) => {
        if (url.includes('/api/auth/csrf-token')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { csrfToken: 'refreshed-token-999' } }),
          };
        }

        callCount++;
        if (callCount === 1) {
          // First attempt fails with CSRF_ERROR
          return {
            ok: false,
            status: 403,
            json: async () => ({
              success: false,
              error: { code: 'CSRF_ERROR', message: 'CSRF token mismatch' },
            }),
          };
        }

        // Retry succeeds
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: { deleted: true } }),
        };
      });

      const res = await api.deleteEvent('evt-1');
      expect(res).toEqual({ deleted: true });
      expect(callCount).toBe(2);
      expect(api.getCsrfToken()).toBe('refreshed-token-999');
    });
  });

  describe('Error Handling', () => {
    it('throws ApiError with server message and status code on failure', async () => {
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found' },
        }),
      }));

      await expect(api.getEvent('missing-id')).rejects.toThrow('Event not found');
    });

    it('handles non-JSON error responses gracefully', async () => {
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Not JSON');
        },
      }));

      await expect(api.getMe()).rejects.toThrow('Request failed with status 500');
    });
  });

  describe('API Methods', () => {
    it('calls getEvents with optional query filters', async () => {
      let capturedUrl = '';
      global.fetch = vi.fn().mockImplementation(async (url) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, data: [] }),
        };
      });

      await api.getEvents({ type: 'wedding', status: 'planning' });
      expect(capturedUrl).toContain('/api/events?type=wedding&status=planning');
    });

    it('calls getHealth and returns storage status', async () => {
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: { status: 'healthy', storage: { type: 'mongodb', isDurable: true } },
        }),
      }));

      const health = await api.getHealth();
      expect(health.status).toBe('healthy');
      expect(health.storage?.type).toBe('mongodb');
    });

    it('calls askAiAssist with prompt and contextType', async () => {
      let capturedBody: any = null;
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        capturedBody = JSON.parse(options?.body as string);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { response: 'Sample advice', suggestions: [] },
          }),
        };
      });

      const res = await api.askAiAssist('evt-1', 'How to reduce costs?', 'budget');
      expect(res.response).toBe('Sample advice');
      expect(capturedBody).toEqual({ prompt: 'How to reduce costs?', contextType: 'budget' });
    });

    it('calls getAiStatus and retryAiPlan', async () => {
      global.fetch = vi.fn().mockImplementation(async (_url, options) => {
        if (options?.method === 'POST') {
          return {
            ok: true,
            status: 200,
            json: async () => ({ success: true, data: { id: 'evt-1', aiPlanStatus: 'pending' } }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: { eventId: 'evt-1', aiPlanStatus: 'completed', aiSuggestionsGenerated: true },
          }),
        };
      });

      const status = await api.getAiStatus('evt-1');
      expect(status.aiPlanStatus).toBe('completed');

      const retried = await api.retryAiPlan('evt-1');
      expect(retried.aiPlanStatus).toBe('pending');
    });

    it('clears CSRF token on logout', async () => {
      api.setCsrfToken('active-token-123');
      global.fetch = vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { message: 'Logged out' } }),
      }));

      await api.logout();
      expect(api.getCsrfToken()).toBeNull();
    });
  });
});
