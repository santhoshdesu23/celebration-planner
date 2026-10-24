import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import {
  CreateEventSchema,
  UpdateEventSchema,
  BudgetItemSchema,
  UpdateBudgetItemSchema,
  TimelineItemSchema,
  UpdateTimelineItemSchema,
  VendorSchema,
  UpdateVendorSchema,
  AiIdeaSchema,
  AiAssistRequestSchema,
  EventQueryFilterSchema,
  type Event as EventType,
} from '@celebration-planner/shared';
import { eventStore } from '../services/eventStore.js';
import { aiService } from '../services/aiService.js';
import { aiJobRunner } from '../services/aiJobRunner.js';
import { aiRateLimiter, guestAiRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';
import { SaveGuestPlanSchema } from '@celebration-planner/shared';

const router = Router();

// In-memory idempotency cache for recent guest draft saves: draftId -> { eventId, ownerId, timestamp }
const savedDraftIdCache = new Map<string, { eventId: string; ownerId: string; timestamp: number }>();

const GuestAiAssistSchema = z.object({
  event: z.object({
    id: z.string().optional(),
    title: z.string().min(1).max(200),
    type: z.string().min(1),
    eventDate: z.string().datetime(),
    guestCount: z.number().int().positive(),
    location: z.string().min(1).max(500),
    budget: z.object({
      currency: z.string().default('USD'),
      totalBudget: z.number().nonnegative(),
      items: z.array(z.any()).default([]),
    }),
  }),
  prompt: z.string().min(1).max(2000),
  contextType: z.string().default('general'),
});

// ─── PUBLIC GUEST ENDPOINTS ──────────────────────────────────────────────────

/**
 * POST /api/events/guest-plan
 * Public unauthenticated endpoint allowing guests to generate a full celebration plan preview
 * without registering or saving data to the database. Protected by guestAiRateLimiter.
 */
router.post('/guest-plan', guestAiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedInput = CreateEventSchema.parse(req.body);
    const plan = await aiService.generateEventPlan({
      title: parsedInput.title,
      type: parsedInput.type,
      eventDate: parsedInput.eventDate,
      guestCount: parsedInput.guestCount,
      location: parsedInput.location,
      description: parsedInput.description,
      budget: parsedInput.budget,
    });

    const now = new Date().toISOString();
    const draftId = crypto.randomUUID();
    const guestPlan: EventType = {
      id: `draft-${draftId}`,
      ownerId: 'guest',
      title: parsedInput.title,
      type: parsedInput.type,
      eventDate: parsedInput.eventDate,
      guestCount: parsedInput.guestCount,
      location: parsedInput.location,
      description: parsedInput.description,
      status: 'draft',
      budget: {
        currency: parsedInput.budget.currency,
        totalBudget: parsedInput.budget.totalBudget,
        items: plan.budgetItems,
      },
      timeline: plan.timeline,
      vendors: plan.vendors,
      ideas: plan.ideas,
      aiSuggestionsGenerated: true,
      aiPlanStatus: 'completed',
      aiPlanCompletedAt: now,
      aiPlanRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    res.status(200).json({ success: true, data: guestPlan });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events/guest-ai-assist
 * Public unauthenticated AI consultation for guest drafts prior to saving.
 */
router.post('/guest-ai-assist', guestAiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = GuestAiAssistSchema.parse(req.body);
    const result = await aiService.askAssistant(
      parsed.event as EventType,
      parsed.prompt,
      parsed.contextType
    );
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// Protect all private event routes with authentication
router.use(requireAuth);

const RouteIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID format');
const UUIDParamSchema = RouteIdSchema;

type SubResourceOpResult =
  | { status: 'SUCCESS'; data: EventType }
  | { status: 'EVENT_NOT_FOUND' }
  | { status: 'ITEM_NOT_FOUND' };

function sendSubResourceResponse(
  res: Response,
  result: SubResourceOpResult,
  successStatus: number = 200,
  itemNotFoundMsg: string = 'Item not found'
): Response | void {
  if (result.status === 'EVENT_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Event not found' },
    });
  }
  if (result.status === 'ITEM_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: itemNotFoundMsg },
    });
  }
  return res.status(successStatus).json({ success: true, data: result.data });
}

// ─── GET /api/events ─────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filter = EventQueryFilterSchema.parse(req.query);
    const userId = req.user!.id;
    const events = await eventStore.findAll(userId, filter);
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events/save-guest-plan
 * Saves an existing guest plan directly into the authenticated user's account.
 * Re-validates all plan sub-resources on the server, derives ownerId strictly from session,
 * and prevents duplicate event creation on network retries using draftId idempotency caching.
 */
router.post('/save-guest-plan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = SaveGuestPlanSchema.parse(req.body);
    const userId = req.user!.id;

    // Check idempotency cache to prevent duplicate creation on retry
    if (parsed.draftId) {
      const cached = savedDraftIdCache.get(parsed.draftId);
      if (cached && cached.ownerId === userId) {
        const existing = await eventStore.findById(cached.eventId, userId);
        if (existing) {
          return res.status(200).json({ success: true, data: existing });
        }
      }
    }

    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const newEvent: EventType = {
      id: eventId,
      ownerId: userId,
      title: parsed.title,
      type: parsed.type,
      eventDate: parsed.eventDate,
      guestCount: parsed.guestCount,
      location: parsed.location,
      description: parsed.description,
      status: 'planning',
      budget: parsed.budget,
      timeline: parsed.timeline,
      vendors: parsed.vendors,
      ideas: parsed.ideas,
      aiSuggestionsGenerated: true,
      aiPlanStatus: 'completed',
      aiPlanCompletedAt: now,
      aiPlanRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await eventStore.create(newEvent);
    if (parsed.draftId) {
      savedDraftIdCache.set(parsed.draftId, {
        eventId,
        ownerId: userId,
        timestamp: Date.now(),
      });
    }

    res.status(201).json({ success: true, data: saved });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/events ────────────────────────────────────────────────────────
router.post('/', aiRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsedInput = CreateEventSchema.parse(req.body);
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const userId = req.user!.id;

    // Persist new event in MongoDB before starting potentially slow AI generation
    const newEvent: EventType = {
      ...parsedInput,
      id: eventId,
      ownerId: userId,
      status: 'planning',
      budget: {
        ...parsedInput.budget,
        items: parsedInput.budget.items || [],
      },
      timeline: [],
      vendors: [],
      ideas: [],
      aiSuggestionsGenerated: false,
      aiPlanStatus: 'pending',
      aiPlanStartedAt: null,
      aiPlanCompletedAt: null,
      aiPlanError: null,
      aiPlanRetryCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const created = await eventStore.create(newEvent);

    // Trigger AI plan generation asynchronously in background
    void aiJobRunner.triggerJob(eventId, userId);

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/events/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const event = await eventStore.findById(id, userId);
    if (!event) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
    }
    res.json({ success: true, data: event });
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/events/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const parsed = UpdateEventSchema.parse(req.body);

    const existing = await eventStore.findById(id, userId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
    }

    // Business logic: When eventDate changes, adjust existing timeline milestone dates
    let updatedTimeline = existing.timeline;
    if (parsed.eventDate && parsed.eventDate !== existing.eventDate) {
      const oldTime = new Date(existing.eventDate).getTime();
      const newTime = new Date(parsed.eventDate).getTime();
      const timeDelta = newTime - oldTime;

      updatedTimeline = existing.timeline.map((item) => {
        const itemTime = new Date(item.dueDate).getTime();
        const adjustedTime = itemTime + timeDelta;
        const finalTime = Math.min(adjustedTime, newTime);
        return {
          ...item,
          dueDate: new Date(finalTime).toISOString(),
        };
      });
    }

    let updatedBudget = existing.budget;
    if (parsed.budget) {
      updatedBudget = {
        ...existing.budget,
        ...parsed.budget,
        items: parsed.budget.items ?? existing.budget.items,
      };
    }

    const payload: Partial<EventType> = {
      ...parsed,
      ...(parsed.eventDate ? { timeline: updatedTimeline } : {}),
      ...(parsed.budget ? { budget: updatedBudget } : {}),
    };

    const updated = await eventStore.update(id, userId, payload);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/events/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const deleted = await eventStore.delete(id, userId);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
    }
    res.json({ success: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/events/:id/ai-assist ──────────────────────────────────────────
router.post(
  '/:id/ai-assist',
  aiRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = UUIDParamSchema.parse(req.params.id);
      const userId = req.user!.id;
      const event = await eventStore.findById(id, userId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found' },
        });
      }

      const { prompt, contextType } = AiAssistRequestSchema.parse(req.body);
      const response = await aiService.askAssistant(event, prompt, contextType);
      res.json({ success: true, data: response });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/events/:id/ai-status ──────────────────────────────────────────
router.get('/:id/ai-status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    let statusInfo = await eventStore.findAiStatus(id, userId);
    if (!statusInfo) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Event not found' },
      });
    }

    // In Serverless execution (e.g. Vercel), background promises freeze when HTTP responses complete.
    // If the plan is 'pending' or interrupted 'processing' with no active in-process runner,
    // actively drive generation to completion during polling so the user never gets stuck.
    if (
      statusInfo.aiPlanStatus === 'pending' ||
      (statusInfo.aiPlanStatus === 'processing' && !aiJobRunner.isJobActive(id, userId))
    ) {
      const generated = await aiJobRunner.triggerJob(id, userId);
      if (generated) {
        statusInfo = {
          eventId: id,
          aiPlanStatus: generated.aiPlanStatus,
          aiSuggestionsGenerated: generated.aiSuggestionsGenerated,
          aiPlanStartedAt: generated.aiPlanStartedAt || null,
          aiPlanCompletedAt: generated.aiPlanCompletedAt || null,
          aiPlanError: generated.aiPlanError || null,
          aiPlanRetryCount: generated.aiPlanRetryCount ?? 0,
        };
      }
    }

    res.json({
      success: true,
      data: statusInfo,
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/events/:id/retry-ai ───────────────────────────────────────────
router.post(
  '/:id/retry-ai',
  aiRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = UUIDParamSchema.parse(req.params.id);
      const userId = req.user!.id;
      const event = await eventStore.findById(id, userId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found' },
        });
      }

      if (
        aiJobRunner.isJobActive(id, userId) ||
        event.aiPlanStatus === 'pending' ||
        event.aiPlanStatus === 'processing'
      ) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'GENERATION_IN_PROGRESS',
            message: 'AI plan generation is currently in progress',
          },
        });
      }

      const reset = await eventStore.resetAiPlanForRetry(id, userId);
      if (!reset) {
        return res.status(409).json({
          success: false,
          error: {
            code: 'GENERATION_IN_PROGRESS',
            message: 'AI plan generation is currently in progress',
          },
        });
      }

      void aiJobRunner.triggerJob(id, userId);

      res.json({ success: true, data: reset });
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /api/events/:id/regenerate-ai ──────────────────────────────────────
router.post(
  '/:id/regenerate-ai',
  aiRateLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = UUIDParamSchema.parse(req.params.id);
      const userId = req.user!.id;
      const event = await eventStore.findById(id, userId);
      if (!event) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Event not found' },
        });
      }

      if (aiJobRunner.isJobActive(id, userId) || event.aiPlanStatus === 'processing') {
        return res.status(409).json({
          success: false,
          error: {
            code: 'GENERATION_IN_PROGRESS',
            message: 'AI plan generation is currently in progress',
          },
        });
      }

      const newPlan = await aiService.generateEventPlan(event);

      const updated = await eventStore.update(event.id, userId, {
        ideas: newPlan.ideas,
        aiSuggestionsGenerated: true,
      });

      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

// ─── SUB-RESOURCE: Budget Items ──────────────────────────────────────────────
router.post('/:id/budget/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const itemInput = BudgetItemSchema.omit({ id: true }).parse(req.body);
    const item = { ...itemInput, id: crypto.randomUUID() };

    const result = await eventStore.addBudgetItem(id, userId, item);
    sendSubResourceResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/budget/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const itemId = UUIDParamSchema.parse(req.params.itemId);
    const userId = req.user!.id;
    const validatedUpdates = UpdateBudgetItemSchema.parse(req.body);

    const result = await eventStore.updateBudgetItem(id, userId, itemId, validatedUpdates);
    sendSubResourceResponse(res, result, 200, 'Budget item not found');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/budget/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const itemId = UUIDParamSchema.parse(req.params.itemId);
    const userId = req.user!.id;

    const result = await eventStore.deleteBudgetItem(id, userId, itemId);
    sendSubResourceResponse(res, result, 200, 'Budget item not found');
  } catch (err) {
    next(err);
  }
});

// ─── SUB-RESOURCE: Timeline Items ────────────────────────────────────────────
router.post('/:id/timeline/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const itemInput = TimelineItemSchema.omit({ id: true }).parse(req.body);
    const item = { ...itemInput, id: crypto.randomUUID() };

    const result = await eventStore.addTimelineItem(id, userId, item);
    sendSubResourceResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/timeline/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const itemId = UUIDParamSchema.parse(req.params.itemId);
    const userId = req.user!.id;
    const validatedUpdates = UpdateTimelineItemSchema.parse(req.body);

    const result = await eventStore.updateTimelineItem(id, userId, itemId, validatedUpdates);
    sendSubResourceResponse(res, result, 200, 'Timeline item not found');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/timeline/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const itemId = UUIDParamSchema.parse(req.params.itemId);
    const userId = req.user!.id;

    const result = await eventStore.deleteTimelineItem(id, userId, itemId);
    sendSubResourceResponse(res, result, 200, 'Timeline item not found');
  } catch (err) {
    next(err);
  }
});

// ─── SUB-RESOURCE: Vendors ───────────────────────────────────────────────────
router.post('/:id/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const vendorInput = VendorSchema.omit({ id: true }).parse(req.body);
    const vendor = { ...vendorInput, id: crypto.randomUUID() };

    const result = await eventStore.addVendor(id, userId, vendor);
    sendSubResourceResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/vendors/:vendorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const vendorId = UUIDParamSchema.parse(req.params.vendorId);
    const userId = req.user!.id;
    const validatedUpdates = UpdateVendorSchema.parse(req.body);

    const result = await eventStore.updateVendor(id, userId, vendorId, validatedUpdates);
    sendSubResourceResponse(res, result, 200, 'Vendor not found');
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/vendors/:vendorId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const vendorId = UUIDParamSchema.parse(req.params.vendorId);
    const userId = req.user!.id;

    const result = await eventStore.deleteVendor(id, userId, vendorId);
    sendSubResourceResponse(res, result, 200, 'Vendor not found');
  } catch (err) {
    next(err);
  }
});

// ─── SUB-RESOURCE: Ideas ─────────────────────────────────────────────────────
router.post('/:id/ideas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const userId = req.user!.id;
    const ideaInput = AiIdeaSchema.omit({ id: true }).parse(req.body);
    const idea = { ...ideaInput, id: crypto.randomUUID() };

    const result = await eventStore.addIdea(id, userId, idea);
    sendSubResourceResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/ideas/:ideaId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = UUIDParamSchema.parse(req.params.id);
    const ideaId = UUIDParamSchema.parse(req.params.ideaId);
    const userId = req.user!.id;

    const result = await eventStore.deleteIdea(id, userId, ideaId);
    sendSubResourceResponse(res, result, 200, 'Idea not found');
  } catch (err) {
    next(err);
  }
});

export default router;
