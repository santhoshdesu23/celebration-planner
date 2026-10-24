import { z } from 'zod';

// ─── Enums ─────────────────────────────────────────────────────────────────────

export const EventTypeEnum = z.enum([
  'wedding',
  'birthday',
  'anniversary',
  'corporate',
  'community',
  'graduation',
  'baby_shower',
  'other',
]);
export type EventType = z.infer<typeof EventTypeEnum>;

export const EventStatusEnum = z.enum([
  'draft',
  'planning',
  'confirmed',
  'completed',
  'cancelled',
]);
export type EventStatus = z.infer<typeof EventStatusEnum>;

export const BudgetCurrencyEnum = z.enum(['USD', 'EUR', 'GBP', 'INR', 'AUD']);
export type BudgetCurrency = z.infer<typeof BudgetCurrencyEnum>;

// ─── Budget ────────────────────────────────────────────────────────────────────

export const BudgetItemSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1).max(100),
  estimatedAmount: z.number().nonnegative(),
  actualAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
  isPaid: z.boolean().default(false),
});
export type BudgetItem = z.infer<typeof BudgetItemSchema>;

export const UpdateBudgetItemSchema = BudgetItemSchema.omit({ id: true }).partial().strict();
export type UpdateBudgetItemInput = z.infer<typeof UpdateBudgetItemSchema>;

export const BudgetSchema = z.object({
  currency: BudgetCurrencyEnum,
  totalBudget: z.number().positive(),
  items: z.array(BudgetItemSchema).default([]),
});
export type Budget = z.infer<typeof BudgetSchema>;

// ─── Timeline ──────────────────────────────────────────────────────────────────

export const TimelineItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueDate: z.string().datetime(),
  isCompleted: z.boolean().default(false),
  category: z.string().max(100).optional(),
});
export type TimelineItem = z.infer<typeof TimelineItemSchema>;

export const UpdateTimelineItemSchema = TimelineItemSchema.omit({ id: true }).partial().strict();
export type UpdateTimelineItemInput = z.infer<typeof UpdateTimelineItemSchema>;

// ─── Vendor ────────────────────────────────────────────────────────────────────

export const VendorStatusEnum = z.enum([
  'not_contacted',
  'contacted',
  'quote_received',
  'booked',
  'cancelled',
]);
export type VendorStatus = z.infer<typeof VendorStatusEnum>;

export const VendorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(30).optional(),
  website: z.string().url().optional().or(z.literal('')),
  status: VendorStatusEnum.default('not_contacted'),
  estimatedCost: z.number().nonnegative().optional(),
  confirmedCost: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
  isAiSuggested: z.boolean().default(false), // clearly mark AI vs. user-added
});
export type Vendor = z.infer<typeof VendorSchema>;

export const UpdateVendorSchema = VendorSchema.omit({ id: true }).partial().strict();
export type UpdateVendorInput = z.infer<typeof UpdateVendorSchema>;

export const EventQueryFilterSchema = z.object({
  type: EventTypeEnum.optional(),
  status: EventStatusEnum.optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  skip: z.coerce.number().int().nonnegative().optional(),
  summary: z.coerce.boolean().optional(),
});
export type EventQueryFilter = z.infer<typeof EventQueryFilterSchema>;

// ─── AI Ideas ──────────────────────────────────────────────────────────────────

export const AiIdeaSchema = z.object({
  id: z.string().uuid(),
  category: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  description: z.string().max(2000),
  tags: z.array(z.string()).default([]),
});
export type AiIdea = z.infer<typeof AiIdeaSchema>;

// ─── Event ─────────────────────────────────────────────────────────────────────

export const CreateEventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200),
  type: EventTypeEnum,
  eventDate: z.string().datetime({ message: 'Event date must be a valid ISO datetime' }),
  guestCount: z.number().int().positive().max(100_000),
  location: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  budget: BudgetSchema,
});
export type CreateEventInput = z.infer<typeof CreateEventSchema>;

export const UpdateEventSchema = CreateEventSchema.partial()
  .extend({
    status: EventStatusEnum.optional(),
  })
  .strict();
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>;

export const SaveGuestPlanSchema = z.object({
  draftId: z.string().max(100).optional(),
  title: z.string().min(1).max(200),
  type: EventTypeEnum,
  eventDate: z.string().datetime({ message: 'Event date must be a valid ISO datetime' }),
  guestCount: z.number().int().positive().max(100_000),
  location: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  budget: BudgetSchema,
  timeline: z.array(TimelineItemSchema).default([]),
  vendors: z.array(VendorSchema).default([]),
  ideas: z.array(AiIdeaSchema).default([]),
});
export type SaveGuestPlanInput = z.infer<typeof SaveGuestPlanSchema>;

export const AiPlanStatusEnum = z.enum(['pending', 'processing', 'completed', 'failed']);
export type AiPlanStatus = z.infer<typeof AiPlanStatusEnum>;

export const EventSchema = CreateEventSchema.extend({
  id: z.string().uuid(),
  ownerId: z.string(),
  status: EventStatusEnum.default('draft'),
  timeline: z.array(TimelineItemSchema).default([]),
  vendors: z.array(VendorSchema).default([]),
  ideas: z.array(AiIdeaSchema).default([]),
  aiSuggestionsGenerated: z.boolean().default(false),
  aiPlanStatus: AiPlanStatusEnum.default('completed'),
  aiPlanStartedAt: z.string().datetime().optional().nullable(),
  aiPlanCompletedAt: z.string().datetime().optional().nullable(),
  aiPlanError: z.string().max(1000).optional().nullable(),
  aiPlanRetryCount: z.number().int().nonnegative().default(0),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Event = z.infer<typeof EventSchema>;

// ─── AI Assistant Request/Response ──────────────────────────────────────────────

export const AiAssistRequestSchema = z.object({
  prompt: z.string().min(1).max(2000),
  contextType: z
    .enum(['general', 'budget', 'timeline', 'vendors', 'ideas'])
    .default('general'),
});
export type AiAssistRequest = z.infer<typeof AiAssistRequestSchema>;

export const AiAssistResponseSchema = z.object({
  response: z.string(),
  suggestions: z.array(z.string()).default([]),
});
export type AiAssistResponse = z.infer<typeof AiAssistResponseSchema>;

export const AiPlanStatusResponseSchema = z.object({
  eventId: z.string().uuid(),
  aiPlanStatus: AiPlanStatusEnum,
  aiPlanError: z.string().nullable().optional(),
  aiPlanStartedAt: z.string().nullable().optional(),
  aiPlanCompletedAt: z.string().nullable().optional(),
  aiPlanRetryCount: z.number().int().nonnegative().optional(),
  aiSuggestionsGenerated: z.boolean(),
});
export type AiPlanStatusResponse = z.infer<typeof AiPlanStatusResponseSchema>;

// ─── API Response shapes ────────────────────────────────────────────────────────

export const ApiSuccessSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
  });

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;
