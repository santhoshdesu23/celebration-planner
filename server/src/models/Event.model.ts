import mongoose, { Schema } from 'mongoose';
import type { Event as EventType } from '@celebration-planner/shared';

const BudgetItemSchema = new Schema(
  {
    id: { type: String, required: true },
    category: { type: String, required: true },
    estimatedAmount: { type: Number, required: true },
    actualAmount: { type: Number },
    notes: { type: String },
    isPaid: { type: Boolean, default: false },
  },
  { _id: false }
);

const TimelineItemSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    dueDate: { type: String, required: true },
    isCompleted: { type: Boolean, default: false },
    category: { type: String },
  },
  { _id: false }
);

const VendorSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    contactEmail: { type: String },
    contactPhone: { type: String },
    website: { type: String },
    status: {
      type: String,
      enum: ['not_contacted', 'contacted', 'quote_received', 'booked', 'cancelled'],
      default: 'not_contacted',
    },
    estimatedCost: { type: Number },
    confirmedCost: { type: Number },
    notes: { type: String },
    isAiSuggested: { type: Boolean, default: false },
  },
  { _id: false }
);

const AiIdeaSchema = new Schema(
  {
    id: { type: String, required: true },
    category: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    tags: [{ type: String }],
  },
  { _id: false }
);

const EventMongoSchema = new Schema<EventType>(
  {
    id: { type: String, required: true, unique: true, index: true },
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    type: {
      type: String,
      enum: [
        'wedding',
        'birthday',
        'anniversary',
        'corporate',
        'community',
        'graduation',
        'baby_shower',
        'other',
      ],
      required: true,
    },
    eventDate: { type: String, required: true },
    guestCount: { type: Number, required: true },
    location: { type: String, required: true },
    description: { type: String },
    status: {
      type: String,
      enum: ['draft', 'planning', 'confirmed', 'completed', 'cancelled'],
      default: 'draft',
    },
    budget: {
      currency: {
        type: String,
        enum: ['USD', 'EUR', 'GBP', 'INR', 'AUD'],
        required: true,
      },
      totalBudget: { type: Number, required: true },
      items: [BudgetItemSchema],
    },
    timeline: [TimelineItemSchema],
    vendors: [VendorSchema],
    ideas: [AiIdeaSchema],
    aiSuggestionsGenerated: { type: Boolean, default: false },
    aiPlanStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'completed',
      index: true,
    },
    aiPlanStartedAt: { type: String },
    aiPlanCompletedAt: { type: String },
    aiPlanError: { type: String },
    aiPlanRetryCount: { type: Number, default: 0 },
    createdAt: { type: String, required: true },
    updatedAt: { type: String, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Compound indexes to optimize query execution and eliminate in-memory sorts
EventMongoSchema.index({ id: 1, ownerId: 1 });
EventMongoSchema.index({ ownerId: 1, createdAt: -1 });
EventMongoSchema.index({ ownerId: 1, type: 1, createdAt: -1 });
EventMongoSchema.index({ ownerId: 1, status: 1, createdAt: -1 });
EventMongoSchema.index({ aiPlanStatus: 1, aiPlanStartedAt: 1, aiPlanRetryCount: 1 });

export const EventModel: mongoose.Model<EventType> =
  (mongoose.models.Event as mongoose.Model<EventType>) ||
  mongoose.model<EventType>('Event', EventMongoSchema);

