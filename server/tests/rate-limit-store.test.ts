import { describe, it, expect, vi, afterEach } from 'vitest';
import { mongoRateLimitStore } from '../src/services/rateLimitStore.js';
import { RateLimitModel } from '../src/models/RateLimit.model.js';

describe('mongoRateLimitStore', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('performs standard atomic increment and returns count with resetTime', async () => {
    const fakeDoc = { _id: 'client-1:100', count: 3 };
    const spy = vi
      .spyOn(RateLimitModel, 'findOneAndUpdate')
      .mockResolvedValueOnce(fakeDoc as any);

    const now = 1_000_000;
    const windowMs = 60_000;
    const result = await mongoRateLimitStore.hit('client-1', windowMs, now);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(result.count).toBe(3);
    const expectedResetTime = (Math.floor(now / windowMs) + 1) * windowMs;
    expect(result.resetTime).toBe(expectedResetTime);
  });

  it('recovers from E11000 duplicate-key race on initial upsert with a single retry', async () => {
    const duplicateKeyError = new Error('E11000 duplicate key error') as any;
    duplicateKeyError.code = 11000;

    const retryDoc = { _id: 'client-race:100', count: 2 };
    const spy = vi
      .spyOn(RateLimitModel, 'findOneAndUpdate')
      .mockRejectedValueOnce(duplicateKeyError)
      .mockResolvedValueOnce(retryDoc as any);

    const now = 1_000_000;
    const windowMs = 60_000;
    const result = await mongoRateLimitStore.hit('client-race', windowMs, now);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.count).toBe(2);
  });

  it('rethrows unexpected non-11000 database errors without retrying', async () => {
    const connectionError = new Error('MongoNetworkError: connection lost');
    const spy = vi
      .spyOn(RateLimitModel, 'findOneAndUpdate')
      .mockRejectedValueOnce(connectionError);

    await expect(
      mongoRateLimitStore.hit('client-err', 60_000, 1_000_000)
    ).rejects.toThrow('MongoNetworkError: connection lost');

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('defaults count to 1 if document returned is nullish', async () => {
    vi.spyOn(RateLimitModel, 'findOneAndUpdate').mockResolvedValueOnce(null as any);

    const result = await mongoRateLimitStore.hit('client-null', 60_000, 1_000_000);
    expect(result.count).toBe(1);
  });
});

