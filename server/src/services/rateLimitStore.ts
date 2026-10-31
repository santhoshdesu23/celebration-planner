import { RateLimitModel } from '../models/RateLimit.model.js';

export interface RateLimitHit {
  count: number;
  /** Epoch ms at which the current window ends. */
  resetTime: number;
}

/** Counter store shared across serverless instances. Implementations must increment atomically. */
export interface SharedRateLimitStore {
  hit(key: string, windowMs: number, now?: number): Promise<RateLimitHit>;
}

/**
 * MongoDB-backed fixed-window counter. One atomic upsert per request: `$inc` on a document whose
 * _id encodes limiter name, client, and window index. Concurrent first hits can race on the upsert
 * (E11000); the loser simply retries the increment once.
 */
export const mongoRateLimitStore: SharedRateLimitStore = {
  async hit(key, windowMs, now = Date.now()) {
    const windowIndex = Math.floor(now / windowMs);
    const resetTime = (windowIndex + 1) * windowMs;
    const id = `${key}:${windowIndex}`;
    // Keep the document slightly past the window so clock skew cannot resurrect a count.
    const expireAt = new Date(resetTime + 60_000);

    const run = () =>
      RateLimitModel.findOneAndUpdate(
        { _id: id },
        { $inc: { count: 1 }, $setOnInsert: { expireAt } },
        { upsert: true, returnDocument: 'after', lean: true }
      );

    let doc;
    try {
      doc = await run();
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        doc = await run();
      } else {
        throw err;
      }
    }
    return { count: doc?.count ?? 1, resetTime };
  },
};

