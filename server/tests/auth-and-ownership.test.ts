import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { userStore } from '../src/services/userStore.js';
import { eventStore } from '../src/services/eventStore.js';
import { getTestAuthHeader, createTestToken } from './helpers/authHelper.js';
import { migrateLegacyEvents, QUARANTINE_OWNER_ID } from '../src/db/migration.js';

const app = createApp();

describe('Authentication & User Model', () => {
  beforeEach(async () => {
    await userStore.clear();
    await eventStore.clear();
  });

  const validRegisterPayload = {
    name: 'Alice Wonderland',
    email: 'Alice@Example.Com', // Intentional mixed case to test normalization
    password: 'SuperSecretPassword123!',
  };

  it('registers a new user, hashes password with bcrypt, and sets HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(validRegisterPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const { user, token } = res.body.data;
    expect(user.id).toBeDefined();
    expect(user.name).toBe('Alice Wonderland');
    expect(user.email).toBe('alice@example.com'); // Lowercased
    expect(user.passwordHash).toBeUndefined(); // NEVER returned
    expect(token).toBeDefined();

    // Check Set-Cookie header
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('auth_token=');
    expect(cookies[0]).toContain('HttpOnly');

    // Verify password was hashed with bcrypt in the store
    const stored = await userStore.findByEmail('alice@example.com');
    expect(stored).not.toBeNull();
    expect(stored?.passwordHash).not.toBe(validRegisterPayload.password);
    const isBcrypt = await bcrypt.compare(validRegisterPayload.password, stored!.passwordHash);
    expect(isBcrypt).toBe(true);
  });

  it('prevents duplicate user registration (case-insensitive email)', async () => {
    await request(app).post('/api/auth/register').send(validRegisterPayload);

    const resDuplicate = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Another Alice',
        email: 'alice@example.com',
        password: 'AnotherPassword456!',
      });

    expect(resDuplicate.status).toBe(409);
    expect(resDuplicate.body.success).toBe(false);
    expect(resDuplicate.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects registration with invalid email or short password', async () => {
    const resBadEmail = await request(app).post('/api/auth/register').send({
      name: 'Bob',
      email: 'not-an-email',
      password: 'validPassword123',
    });
    expect(resBadEmail.status).toBe(400);

    const resShortPass = await request(app).post('/api/auth/register').send({
      name: 'Bob',
      email: 'bob@example.com',
      password: 'short',
    });
    expect(resShortPass.status).toBe(400);
  });

  it('logs in successfully with correct credentials and returns safe user data', async () => {
    await request(app).post('/api/auth/register').send(validRegisterPayload);

    const resLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@example.com',
        password: validRegisterPayload.password,
      });

    expect(resLogin.status).toBe(200);
    expect(resLogin.body.success).toBe(true);
    expect(resLogin.body.data.user.email).toBe('alice@example.com');
    expect(resLogin.body.data.user.passwordHash).toBeUndefined();
    expect(resLogin.body.data.token).toBeDefined();

    const cookies = resLogin.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies[0]).toContain('auth_token=');
    expect(cookies[0]).toContain('HttpOnly');
  });

  it('rejects login with incorrect password with 401 and generic message', async () => {
    await request(app).post('/api/auth/register').send(validRegisterPayload);

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'alice@example.com',
        password: 'WrongPassword999!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rejects login with non-existent email with consistent 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'doesnotexist@example.com',
        password: 'AnyPassword123!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('GET /api/auth/me returns current user when authenticated and 401 when not', async () => {
    // Unauthenticated
    const resUnauth = await request(app).get('/api/auth/me');
    expect(resUnauth.status).toBe(401);

    // Register user
    const regRes = await request(app).post('/api/auth/register').send(validRegisterPayload);
    const token = regRes.body.data.token;

    // Authenticated via Authorization header
    const resBearer = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(resBearer.status).toBe(200);
    expect(resBearer.body.data.user.email).toBe('alice@example.com');

    // Authenticated via Cookie
    const resCookie = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `auth_token=${token}`);
    expect(resCookie.status).toBe(200);
    expect(resCookie.body.data.user.email).toBe('alice@example.com');
  });

  it('POST /api/auth/logout clears auth cookie', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    // Cookie should be cleared / expired
    expect(cookies[0]).toMatch(/auth_token=;.*Expires=/i);
  });
});

describe('Per-User Event Ownership & Cross-User Authorization', () => {
  const userA = {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'userA@example.com',
    name: 'User A',
  };
  const userB = {
    id: '22222222-2222-2222-2222-222222222222',
    email: 'userB@example.com',
    name: 'User B',
  };

  const tokenA = createTestToken(userA);
  const tokenB = createTestToken(userB);

  const baseEventInput = {
    title: 'User A Celebration',
    type: 'birthday',
    eventDate: '2027-08-15T18:00:00.000Z',
    guestCount: 40,
    location: 'Rooftop Terrace',
    budget: {
      currency: 'USD',
      totalBudget: 5000,
      items: [],
    },
  };

  beforeEach(async () => {
    await userStore.clear();
    await eventStore.clear();
  });

  it('requires authentication for all event operations (returns 401)', async () => {
    const resGet = await request(app).get('/api/events');
    expect(resGet.status).toBe(401);

    const resPost = await request(app).post('/api/events').send(baseEventInput);
    expect(resPost.status).toBe(401);

    const resDetail = await request(app).get('/api/events/any-id');
    expect(resDetail.status).toBe(401);
  });

  it('creates event associated exclusively with authenticated user and filters lists', async () => {
    // User A creates Event A
    const resA = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...baseEventInput, title: 'Event A by User A' });
    expect(resA.status).toBe(201);
    const eventA = resA.body.data;
    expect(eventA.ownerId).toBe(userA.id);

    // User B creates Event B
    const resB = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ ...baseEventInput, title: 'Event B by User B' });
    expect(resB.status).toBe(201);
    const eventB = resB.body.data;
    expect(eventB.ownerId).toBe(userB.id);

    // User A lists events -> sees ONLY Event A
    const listA = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data).toHaveLength(1);
    expect(listA.body.data[0].id).toBe(eventA.id);
    expect(listA.body.data[0].title).toBe('Event A by User A');

    // User B lists events -> sees ONLY Event B
    const listB = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.data).toHaveLength(1);
    expect(listB.body.data[0].id).toBe(eventB.id);
    expect(listB.body.data[0].title).toBe('Event B by User B');
  });

  it('prevents User B from reading, updating, or deleting User A event (returns 404)', async () => {
    // User A creates Event A
    const resCreate = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(baseEventInput);
    const eventAId = resCreate.body.data.id;

    // User B tries to read Event A -> 404
    const resReadB = await request(app)
      .get(`/api/events/${eventAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resReadB.status).toBe(404);
    expect(resReadB.body.error.code).toBe('NOT_FOUND');

    // User B tries to update Event A -> 404
    const resUpdateB = await request(app)
      .patch(`/api/events/${eventAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hacked Title' });
    expect(resUpdateB.status).toBe(404);

    // User B tries to delete Event A -> 404
    const resDeleteB = await request(app)
      .delete(`/api/events/${eventAId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resDeleteB.status).toBe(404);

    // Verify Event A is untouched and still readable by User A
    const resReadA = await request(app)
      .get(`/api/events/${eventAId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resReadA.status).toBe(200);
    expect(resReadA.body.data.title).toBe(baseEventInput.title);
  });

  it('prevents User B from accessing sub-resources (budget, timeline, vendors, ideas) on User A event', async () => {
    const resCreate = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(baseEventInput);
    const eventAId = resCreate.body.data.id;

    // Budget item
    const resBudget = await request(app)
      .post(`/api/events/${eventAId}/budget/items`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ category: 'Catering', estimatedAmount: 1500 });
    expect(resBudget.status).toBe(404);

    // Timeline item
    const resTimeline = await request(app)
      .post(`/api/events/${eventAId}/timeline/items`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Tasting', dueDate: '2027-08-01T10:00:00.000Z' });
    expect(resTimeline.status).toBe(404);

    // Vendor item
    const resVendor = await request(app)
      .post(`/api/events/${eventAId}/vendors`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Sunset Catering', category: 'Catering' });
    expect(resVendor.status).toBe(404);

    // Custom idea
    const resIdea = await request(app)
      .post(`/api/events/${eventAId}/ideas`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ category: 'Theme', title: 'Boho Sunset', description: 'Cozy lounge' });
    expect(resIdea.status).toBe(404);
  });

  it('enforces ownership on AI assist and regeneration endpoints', async () => {
    const resCreate = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(baseEventInput);
    const eventAId = resCreate.body.data.id;

    // User B tries AI assist on Event A -> 404
    const resAiAssist = await request(app)
      .post(`/api/events/${eventAId}/ai-assist`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ prompt: 'Give me budget tips', contextType: 'budget' });
    expect(resAiAssist.status).toBe(404);

    // User B tries regenerate AI on Event A -> 404
    const resRegen = await request(app)
      .post(`/api/events/${eventAId}/regenerate-ai`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resRegen.status).toBe(404);
  });

  it('quarantines legacy events without ownerId and prevents users from accessing them', async () => {
    // Inject legacy event with quarantine ID or unassigned
    const legacyEvent = {
      ...baseEventInput,
      id: '99999999-9999-9999-9999-999999999999',
      ownerId: QUARANTINE_OWNER_ID,
      status: 'planning' as const,
      timeline: [],
      vendors: [],
      ideas: [],
      aiSuggestionsGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await eventStore.create(legacyEvent);

    // User A cannot read legacy quarantined event
    const resA = await request(app)
      .get(`/api/events/${legacyEvent.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(resA.status).toBe(404);

    // User A does not see quarantined event in their list
    const listA = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(listA.body.data).toHaveLength(0);

    // User B also cannot read or list it
    const resB = await request(app)
      .get(`/api/events/${legacyEvent.id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(resB.status).toBe(404);
  });
});
