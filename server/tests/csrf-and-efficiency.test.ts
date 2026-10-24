import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { userStore } from '../src/services/userStore.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiService } from '../src/services/aiService.js';
import {
  sanitizeErrorMessage,
  formatSafeError,
} from '../src/config/env.js';
import {
  generateCsrfToken,
  CSRF_COOKIE_NAME,
  safeTokenCompare,
} from '../src/middleware/csrf.js';

const app = createApp();

describe('P1 Fixes: AI Sanitization, CSRF Defense, & Budget Efficiency', () => {
  beforeEach(async () => {
    await userStore.clear();
    await eventStore.clear();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SECURITY: AI Error Logging & Credential Sanitization
  // ─────────────────────────────────────────────────────────────────────────────
  describe('AI Error Logging & Credential Sanitization', () => {
    it('redacts MongoDB URIs with credentials from error messages', () => {
      const rawError = 'Failed to connect to mongodb+srv://app_user:SuperSecretPassword123@cluster0.uchxflq.mongodb.net/test';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('app_user');
      expect(sanitized).not.toContain('SuperSecretPassword123');
      expect(sanitized).toContain('mongodb+srv://***:***@cluster0.uchxflq.mongodb.net/test');
    });

    it('redacts Google / Gemini API keys from error messages', () => {
      const rawError = 'GoogleGenerativeAI error: Request failed for key AIzaSyD1234567890abcdefghijklmnopqrstuv at https://generativelanguage.googleapis.com?key=AIzaSyD1234567890abcdefghijklmnopqrstuv';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
      expect(sanitized).toContain('AIza***REDACTED***');
      expect(sanitized).toContain('key=***');
    });

    it('redacts Bearer tokens and Authorization headers', () => {
      const rawError = 'Unauthorized access with header Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.abcdef123456';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyJ9.abcdef123456');
      expect(sanitized).toContain('Authorization: ***');
    });

    it('redacts auth and session cookies from error logs', () => {
      const rawError = 'Cookie parse failure: auth_token=somerandomjwttokenstring; csrf_token=a1b2c3d4e5f6; connect.sid=sessionid123';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('somerandomjwttokenstring');
      expect(sanitized).not.toContain('a1b2c3d4e5f6');
      expect(sanitized).not.toContain('sessionid123');
      expect(sanitized).toContain('auth_token=***');
      expect(sanitized).toContain('csrf_token=***');
    });

    it('redacts passwords in queries, key-values, and json strings', () => {
      const rawError = 'DB connection error: user=admin&password=mysecretpassword123&ssl=true';
      const sanitized = sanitizeErrorMessage(rawError);
      expect(sanitized).not.toContain('mysecretpassword123');
      expect(sanitized).toContain('password=***');
    });

    it('SEC-03: redacts quoted JSON passwords and secrets with spaces without truncating remainder', () => {
      const jsonError = 'Failed payload: {"email": "user@example.com", "password": "My Secret Password 123!", "secret": "phrase with spaces, commas"}';
      const sanitized = sanitizeErrorMessage(jsonError);
      expect(sanitized).not.toContain('My Secret Password 123!');
      expect(sanitized).not.toContain('phrase with spaces, commas');
      expect(sanitized).toContain('"password": "***"');
      expect(sanitized).toContain('"secret": "***"');
    });

    it('SEC-03: redacts database URIs including postgresql, mysql, redis, and mongodb', () => {
      const pgError = 'Error: could not connect to postgres://app_user:SuperSecretPgPass@dbhost:5432/appdb';
      const sanitized = sanitizeErrorMessage(pgError);
      expect(sanitized).not.toContain('SuperSecretPgPass');
      expect(sanitized).toContain('postgres://***:***@dbhost:5432/appdb');
    });

    it('SEC-03: does not corrupt unrelated log messages containing words like pass or secret', () => {
      const normalMsg = 'User passed verification check and completed the milestone planning phase.';
      expect(sanitizeErrorMessage(normalMsg)).toBe(normalMsg);
    });

    it('formatSafeError extracts safe sanitized message without leaking raw object or stacks', () => {
      const errorObj = new Error('Connection failed to mongodb://root:MyP@ssword@localhost:27017/admin with key=AIzaSyD1234567890abcdefghijklmnopqrstuv');
      const safe = formatSafeError(errorObj);
      expect(safe).toContain('Error: Connection failed');
      expect(safe).not.toContain('MyP@ssword');
      expect(safe).not.toContain('AIzaSyD1234567890abcdefghijklmnopqrstuv');
      expect(safe).toContain('mongodb://***:***@localhost:27017/admin');
    });

    it('formatSafeError safely handles non-Error objects and primitives', () => {
      expect(formatSafeError('String error message')).toBe('String error message');
      expect(formatSafeError({ message: 'Custom object error' })).toBe('Custom object error');
      expect(formatSafeError(null)).toBe('Unknown error');
      expect(formatSafeError(undefined)).toBe('Unknown error');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. SECURITY: CSRF Protection & Origin Defense
  // ─────────────────────────────────────────────────────────────────────────────
  describe('CSRF Protection & Origin Defense', () => {
    const registerPayload = {
      name: 'CSRF Test User',
      email: 'csrf-tester@example.com',
      password: 'StrongPassword123!',
    };

    it('registers user and issues both auth_token (HttpOnly) and csrf_token cookies plus csrfToken in body', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.csrfToken).toBeDefined();

      const setCookies = res.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='));
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='));

      expect(authCookie).toBeDefined();
      expect(authCookie).toContain('HttpOnly');

      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).not.toContain('HttpOnly'); // Must be accessible to JS for double-submit
    });

    it('provides a dedicated GET /api/auth/csrf-token endpoint', async () => {
      const res = await request(app).get('/api/auth/csrf-token');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.csrfToken).toBeDefined();

      const setCookies = res.headers['set-cookie'] || [];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='));
      expect(csrfCookie).toBeDefined();
    });

    it('rejects cookie-authenticated POST requests missing X-CSRF-Token header with 403 CSRF_ERROR', async () => {
      // 1. Register to obtain cookies
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      // 2. Attempt POST /api/events with auth_token cookie BUT without X-CSRF-Token header
      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .send({
          title: 'Tampered Event',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
      expect(res.body.error.message).toContain('CSRF');
    });

    it('rejects cookie-authenticated POST requests with mismatched X-CSRF-Token header with 403 CSRF_ERROR', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', 'completely-wrong-token-value')
        .send({
          title: 'Tampered Event',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
    });

    it('rejects state-changing requests from untrusted cross-origin origins', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'https://malicious-phishing-site.com')
        .send({
          title: 'Cross Origin Attack',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
      expect(res.body.error.message).toContain('Cross-origin request rejected');
    });

    it('SEC-01: rejects state-changing requests when attacker sets matching Host and Origin headers', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      // Attacker attempts to spoof Host: evil.attacker.com and Origin: http://evil.attacker.com
      const res = await request(app)
        .post('/api/events')
        .set('Host', 'evil.attacker.com')
        .set('Origin', 'http://evil.attacker.com')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Host Spoofed Event',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
      expect(res.body.error.message).toContain('Cross-origin request rejected');
    });

    it('SEC-02: rejects state-changing requests when Origin is absent and Referer is malformed', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/events')
        .set('Referer', 'not-a-valid-referer-url')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Malformed Referer Event',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
      expect(res.body.error.message).toContain('Malformed Referer header rejected');
    });

    it('SEC-05: safeTokenCompare performs constant-time comparison and handles edge cases safely', () => {
      const validToken = generateCsrfToken();
      const identicalToken = `${validToken}`;
      const wrongSameLength = 'a'.repeat(validToken.length);
      const shorterToken = 'a'.repeat(validToken.length - 1);
      const longerToken = 'a'.repeat(validToken.length + 1);

      expect(safeTokenCompare(validToken, identicalToken)).toBe(true);
      expect(safeTokenCompare(validToken, wrongSameLength)).toBe(false);
      expect(safeTokenCompare(validToken, shorterToken)).toBe(false);
      expect(safeTokenCompare(validToken, longerToken)).toBe(false);
      expect(safeTokenCompare(validToken, '')).toBe(false);
      expect(safeTokenCompare('', validToken)).toBe(false);
      expect(safeTokenCompare(validToken, undefined)).toBe(false);
      expect(safeTokenCompare(undefined, validToken)).toBe(false);
      expect(safeTokenCompare(null, validToken)).toBe(false);
      expect(safeTokenCompare(12345, validToken)).toBe(false);
    });

    it('SEC-05: rejects cookie-authenticated requests when header token length differs from cookie token length', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', 'short')
        .send({
          title: 'Unequal Length CSRF Event',
          type: 'birthday',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 50,
          location: 'Test Venue',
          budget: { currency: 'USD', totalBudget: 5000, items: [] },
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CSRF_ERROR');
    });

    it('allows cookie-authenticated state-changing requests when matching X-CSRF-Token header and valid origin are provided', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken)
        .set('Origin', 'http://localhost:5173')
        .send({
          title: 'Legitimate Protected Event',
          type: 'wedding',
          eventDate: '2027-10-15T18:00:00.000Z',
          guestCount: 100,
          location: 'Grand Ballroom',
          budget: { currency: 'USD', totalBudget: 25000, items: [] },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.title).toBe('Legitimate Protected Event');
    });

    it('safe GET requests are never blocked by CSRF checks', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];

      // GET /api/auth/me has auth_token cookie but no CSRF header
      const res = await request(app)
        .get('/api/auth/me')
        .set('Cookie', [authCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('csrf-tester@example.com');
    });

    it('POST /api/auth/logout clears both auth_token and csrf_token cookies', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send(registerPayload);

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const clearedCookies = res.headers['set-cookie'] || [];
      const clearedAuth = clearedCookies.find((c: string) => c.startsWith('auth_token=;'));
      const clearedCsrf = clearedCookies.find((c: string) => c.startsWith('csrf_token=;'));

      expect(clearedAuth).toBeDefined();
      expect(clearedCsrf).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. EFFICIENCY: Redundant AI Budget Generation
  // ─────────────────────────────────────────────────────────────────────────────
  describe('Redundant AI Budget Generation Efficiency', () => {
    it('preserves user-supplied budget items and skips duplicate synthetic budget generation', async () => {
      const userBudgetItems = [
        {
          id: '11111111-1111-1111-1111-111111111111',
          category: 'Historic Castle Venue',
          estimatedAmount: 18000,
          actualAmount: 0,
          isPaid: false,
          notes: 'Exclusive rental deposit paid',
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          category: 'Michelin Star Catering',
          estimatedAmount: 22000,
          actualAmount: 0,
          isPaid: false,
          notes: '5-course seasonal tasting',
        },
      ];

      const plan = await aiService.generateEventPlan({
        title: 'Chateau Wedding',
        type: 'wedding',
        eventDate: '2027-06-15T16:00:00.000Z',
        guestCount: 80,
        location: 'Loire Valley, France',
        description: 'Bespoke European estate celebration',
        budget: {
          currency: 'EUR',
          totalBudget: 40000,
          items: userBudgetItems,
        },
      });

      // Budget items must match user-specified items exactly without generating fallback ratios
      expect(plan.budgetItems).toHaveLength(2);
      expect(plan.budgetItems[0].category).toBe('Historic Castle Venue');
      expect(plan.budgetItems[0].estimatedAmount).toBe(18000);
      expect(plan.budgetItems[1].category).toBe('Michelin Star Catering');
      expect(plan.budgetItems[1].estimatedAmount).toBe(22000);

      // Ideas, timeline, and vendors are still generated
      expect(plan.ideas.length).toBeGreaterThanOrEqual(4);
      expect(plan.timeline.length).toBeGreaterThanOrEqual(5);
      expect(plan.vendors.length).toBeGreaterThanOrEqual(4);
    });

    it('generates fallback budget breakdown when user supplies no budget items', async () => {
      const plan = await aiService.generateEventPlan({
        title: 'Milestone 40th Birthday',
        type: 'birthday',
        eventDate: '2027-11-20T19:00:00.000Z',
        guestCount: 60,
        location: 'Rooftop Lounge, Chicago',
        description: 'Vibrant celebration with skyline views',
        budget: {
          currency: 'USD',
          totalBudget: 15000,
          items: [],
        },
      });

      // Generates fallback budget breakdown for birthday
      expect(plan.budgetItems.length).toBeGreaterThanOrEqual(4);
      const totalEstimated = plan.budgetItems.reduce((sum, item) => sum + item.estimatedAmount, 0);
      expect(totalEstimated).toBeCloseTo(15000, -2);
    });

    it('end-to-end: POST /api/events with custom budget items retains them deterministically in the created event', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Budget Plan Tester',
          email: 'budget-tester@example.com',
          password: 'Password123!',
        });

      const csrfToken = regRes.body.data.csrfToken;
      const setCookies = regRes.headers['set-cookie'] || [];
      const authCookie = setCookies.find((c: string) => c.startsWith('auth_token='))!.split(';')[0];
      const csrfCookie = setCookies.find((c: string) => c.startsWith('csrf_token='))!.split(';')[0];

      const customItems = [
        {
          id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          category: 'Custom Venue Fee',
          estimatedAmount: 5000,
          actualAmount: 0,
          isPaid: true,
        },
        {
          id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
          category: 'Custom Live Band',
          estimatedAmount: 3000,
          actualAmount: 0,
          isPaid: false,
        },
      ];

      const res = await request(app)
        .post('/api/events')
        .set('Cookie', [authCookie, csrfCookie])
        .set('X-CSRF-Token', csrfToken)
        .send({
          title: 'Custom Budget Celebration',
          type: 'corporate',
          eventDate: '2027-08-10T14:00:00.000Z',
          guestCount: 120,
          location: 'San Francisco, CA',
          budget: {
            currency: 'USD',
            totalBudget: 8000,
            items: customItems,
          },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.budget.items).toHaveLength(2);
      expect(res.body.data.budget.items[0].category).toBe('Custom Venue Fee');
      expect(res.body.data.budget.items[0].isPaid).toBe(true);
      expect(res.body.data.budget.items[1].category).toBe('Custom Live Band');
    });
  });
});
