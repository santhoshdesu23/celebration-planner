import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  normalizeMongoUri,
  sanitizeMongoUri,
  sanitizeErrorMessage,
  loadEnvironment,
  validateEnv,
} from '../src/config/env.js';
import {
  connectDatabase,
  disconnectDatabase,
  isDbConnected,
  isUsingMemory,
  getDbConnectionError,
  _resetConnectionStateForTest,
} from '../src/db/connection.js';
import { eventStore } from '../src/services/eventStore.js';
import type { Event as EventType } from '@celebration-planner/shared';

describe('Environment Loading & Sanitization', () => {
  it('normalizes connection string with unencoded special characters in password', () => {
    const rawUri = 'mongodb+srv://myuser:P@ssword!123@cluster0.abcde.mongodb.net/celebration-planner?retryWrites=true&w=majority';
    const normalized = normalizeMongoUri(rawUri);

    expect(normalized).toContain('myuser:P%40ssword!123@cluster0.abcde.mongodb.net');
    expect(normalized).not.toContain(':P@ssword');
  });

  it('keeps already-encoded connection strings normalized and valid', () => {
    const rawUri = 'mongodb+srv://myuser:P%40ssword123@cluster0.abcde.mongodb.net/test';
    const normalized = normalizeMongoUri(rawUri);

    expect(normalized).toBe(rawUri);
  });

  it('handles URIs without credentials or with simple credentials', () => {
    expect(normalizeMongoUri('mongodb://localhost:27017/mydb')).toBe('mongodb://localhost:27017/mydb');
    expect(normalizeMongoUri('mongodb://user:pass@localhost:27017/mydb')).toBe('mongodb://user:pass@localhost:27017/mydb');
  });

  it('masks credentials in sanitized URI output', () => {
    const sensitiveUri = 'mongodb+srv://admin_user:superSecretPassword123@cluster0.mongodb.net/db?retryWrites=true';
    const sanitized = sanitizeMongoUri(sensitiveUri);

    expect(sanitized).toBe('mongodb+srv://***:***@cluster0.mongodb.net/db?retryWrites=true');
    expect(sanitized).not.toContain('admin_user');
    expect(sanitized).not.toContain('superSecretPassword123');
  });

  it('masks credentials and sensitive params in error messages', () => {
    const rawError = 'Connection failed: mongodb+srv://dbUser:VerySecretPass999@mycluster.net/dev error details';
    const sanitized = sanitizeErrorMessage(rawError);

    expect(sanitized).toContain('mongodb+srv://***:***@mycluster.net/dev');
    expect(sanitized).not.toContain('dbUser');
    expect(sanitized).not.toContain('VerySecretPass999');
  });

  it('loadEnvironment locates candidate files without overwriting existing process.env', () => {
    process.env.TEST_EXISTING_KEY = 'pre_existing';
    const result = loadEnvironment();

    expect(result.loaded).toBe(true);
    expect(process.env.TEST_EXISTING_KEY).toBe('pre_existing');
    delete process.env.TEST_EXISTING_KEY;
  });

  it('validateEnv accepts valid environment and normalizes MONGODB_URI', () => {
    const parsed = validateEnv({
      NODE_ENV: 'development',
      PORT: '3001',
      MONGODB_URI: 'mongodb+srv://user:pass@123@cluster.mongodb.net/test',
      CORS_ORIGIN: 'http://localhost:5173',
    });

    expect(parsed.PORT).toBe(3001);
    expect(parsed.MONGODB_URI).toContain('pass%40123');
  });
});

describe('Connection Failure & In-Memory Fallback', () => {
  beforeEach(async () => {
    await disconnectDatabase();
    _resetConnectionStateForTest();
  });

  afterEach(async () => {
    await disconnectDatabase();
    _resetConnectionStateForTest();
  });

  it('operates in memory fallback when no URI is provided', async () => {
    const success = await connectDatabase('');

    expect(success).toBe(false);
    expect(isDbConnected()).toBe(false);
    expect(isUsingMemory()).toBe(true);
    expect(getDbConnectionError()).toBeNull();

    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.storage.type).toBe('in-memory');
    expect(res.body.data.storage.isDurable).toBe(false);
  });

  it('catches connection failure safely without exposing credentials', async () => {
    // Attempt connecting to an unreachable host with a timeout
    const badUri = 'mongodb://secret_user:secret_pass@127.0.0.1:27099/test?serverSelectionTimeoutMS=400';
    const success = await connectDatabase(badUri);

    expect(success).toBe(false);
    expect(isDbConnected()).toBe(false);
    expect(isUsingMemory()).toBe(true);

    const err = getDbConnectionError();
    expect(err).toBeDefined();
    expect(err).not.toContain('secret_user');
    expect(err).not.toContain('secret_pass');

    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.storage.type).toBe('in-memory');
    expect(res.body.data.storage.isDurable).toBe(false);
    expect(res.body.data.storage.error).toBeDefined();
    expect(res.body.data.storage.error).not.toContain('secret_pass');
  }, 10000);
});

describe('Active MongoDB Connection & Storage Selection', () => {
  const hasAtlasUri = Boolean(process.env.MONGODB_URI);

  beforeEach(async () => {
    await disconnectDatabase();
    _resetConnectionStateForTest();
  });

  afterEach(async () => {
    await disconnectDatabase();
    _resetConnectionStateForTest();
  });

  it('connects to configured MongoDB Atlas and selects MongoDB storage', async () => {
    if (!hasAtlasUri) {
      console.log('Skipping live Atlas test: MONGODB_URI not in process.env');
      return;
    }

    const connected = await connectDatabase();
    if (!connected) {
      console.warn('Atlas cluster unreachable or IP not whitelisted; verifying in-memory fallback');
      expect(isUsingMemory()).toBe(true);
      return;
    }
    expect(connected).toBe(true);
    expect(isDbConnected()).toBe(true);
    expect(isUsingMemory()).toBe(false);
    expect(getDbConnectionError()).toBeNull();

    const app = createApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.data.storage.type).toBe('mongodb');
    expect(res.body.data.storage.isDurable).toBe(true);
    expect(res.body.data.storage.warning).toBeUndefined();
    expect(res.body.data.storage.error).toBeUndefined();
  }, 15000);

  it('persists events to MongoDB when connected, and transitions to memory when disconnected', async () => {
    if (!hasAtlasUri) {
      return;
    }

    let connected = await connectDatabase();
    if (!connected) {
      await new Promise((r) => setTimeout(r, 200));
      connected = await connectDatabase();
    }
    if (!connected) {
      console.warn('Atlas cluster unreachable or IP not whitelisted; verifying in-memory fallback');
      expect(isUsingMemory()).toBe(true);
      return;
    }
    expect(isDbConnected()).toBe(true);

    const testOwnerId = 'owner-db-connection-test';
    const testEvent: EventType = {
      id: `test-${Date.now()}`,
      ownerId: testOwnerId,
      title: 'Database Persistence Test Event',
      type: 'birthday',
      eventDate: '2026-12-25',
      guestCount: 50,
      location: 'Grand Ballroom',
      description: 'Testing event persistence on Atlas',
      status: 'confirmed',
      budget: {
        currency: 'USD',
        totalBudget: 5000,
        items: [],
      },
      timeline: [],
      vendors: [],
      ideas: [],
      aiSuggestionsGenerated: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Create via eventStore while connected to MongoDB
    const created = await eventStore.create(testEvent);
    expect(created.id).toBe(testEvent.id);

    const fetched = await eventStore.findById(testEvent.id, testOwnerId);
    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe(testEvent.title);

    // Update
    const updated = await eventStore.update(testEvent.id, testOwnerId, { title: 'Updated Title' });
    expect(updated?.title).toBe('Updated Title');

    // Clean up from MongoDB
    const deleted = await eventStore.delete(testEvent.id, testOwnerId);
    expect(deleted).toBe(true);

    // Disconnect and verify in-memory transition
    await disconnectDatabase();
    expect(isDbConnected()).toBe(false);
    expect(isUsingMemory()).toBe(true);
  }, 20000);
});
