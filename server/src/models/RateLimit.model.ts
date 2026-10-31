import mongoose, { Schema } from 'mongoose';

interface RateLimitDoc {
  _id: string;
  count: number;
  expireAt: Date;
}

/**
 * Fixed-window counters shared by every serverless instance (stored in the existing MongoDB cluster).
 * Documents expire automatically via the TTL index, so the collection stays tiny.
 */
const RateLimitSchema = new Schema<RateLimitDoc>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expireAt: { type: Date, required: true },
  },
  { versionKey: false, collection: 'ratelimits' }
);

RateLimitSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitModel: mongoose.Model<RateLimitDoc> =
  (mongoose.models.RateLimit as mongoose.Model<RateLimitDoc>) ||
  mongoose.model<RateLimitDoc>('RateLimit', RateLimitSchema);

