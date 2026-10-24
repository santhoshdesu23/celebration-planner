import type {
  Event as EventType,
  EventQueryFilter,
  BudgetItem,
  UpdateBudgetItemInput,
  TimelineItem,
  UpdateTimelineItemInput,
  Vendor,
  UpdateVendorInput,
  AiIdea,
} from '@celebration-planner/shared';
import { EventModel } from '../models/Event.model.js';
import { isDbConnected } from '../db/connection.js';

export interface EventAiStatusInfo {
  eventId: string;
  aiPlanStatus: 'pending' | 'processing' | 'completed' | 'failed';
  aiPlanError: string | null;
  aiPlanStartedAt: string | null;
  aiPlanCompletedAt: string | null;
  aiPlanRetryCount: number;
  aiSuggestionsGenerated: boolean;
}

export type AddSubResourceResult<T = EventType> =
  | { status: 'SUCCESS'; data: T }
  | { status: 'EVENT_NOT_FOUND' };

export type SubResourceResult<T = EventType> =
  | { status: 'SUCCESS'; data: T }
  | { status: 'EVENT_NOT_FOUND' }
  | { status: 'ITEM_NOT_FOUND' };

// In-Memory store fallback
const memoryEvents = new Map<string, EventType>();

export const eventStore = {
  async create(event: EventType): Promise<EventType> {
    if (isDbConnected()) {
      const created = await EventModel.create(event);
      return created.toObject ? created.toObject() : (created as EventType);
    }
    // Deep clone to prevent mutation bugs
    const cloned = JSON.parse(JSON.stringify(event));
    memoryEvents.set(event.id, cloned);
    return cloned;
  },

  async findById(id: string, ownerId: string): Promise<EventType | null> {
    if (isDbConnected()) {
      const doc = await EventModel.findOne({ id, ownerId }).lean();
      return (doc as EventType) || null;
    }
    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;
    return JSON.parse(JSON.stringify(event));
  },

  /**
   * Targeted minimal projection for polling AI plan status.
   * Avoids querying or transmitting bulky arrays (ideas, timeline, vendors, budget).
   */
  async findAiStatus(id: string, ownerId: string): Promise<EventAiStatusInfo | null> {
    if (isDbConnected()) {
      const doc = await EventModel.findOne(
        { id, ownerId },
        {
          id: 1,
          aiPlanStatus: 1,
          aiPlanError: 1,
          aiPlanStartedAt: 1,
          aiPlanCompletedAt: 1,
          aiPlanRetryCount: 1,
          aiSuggestionsGenerated: 1,
        }
      ).lean();
      if (!doc) return null;
      return {
        eventId: doc.id,
        aiPlanStatus: doc.aiPlanStatus || 'completed',
        aiPlanError: doc.aiPlanError || null,
        aiPlanStartedAt: doc.aiPlanStartedAt || null,
        aiPlanCompletedAt: doc.aiPlanCompletedAt || null,
        aiPlanRetryCount: doc.aiPlanRetryCount || 0,
        aiSuggestionsGenerated: Boolean(doc.aiSuggestionsGenerated),
      };
    }

    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;
    return {
      eventId: event.id,
      aiPlanStatus: event.aiPlanStatus || 'completed',
      aiPlanError: event.aiPlanError || null,
      aiPlanStartedAt: event.aiPlanStartedAt || null,
      aiPlanCompletedAt: event.aiPlanCompletedAt || null,
      aiPlanRetryCount: event.aiPlanRetryCount || 0,
      aiSuggestionsGenerated: Boolean(event.aiSuggestionsGenerated),
    };
  },

  async findAll(ownerId: string, filter?: EventQueryFilter): Promise<EventType[]> {
    const limit = filter?.limit ?? 50;
    const skip = filter?.skip ?? 0;
    const isSummary = Boolean(filter?.summary);

    if (isDbConnected()) {
      const query: Record<string, string> = { ownerId };
      if (filter?.type) query.type = filter.type;
      if (filter?.status) query.status = filter.status;

      let projection: Record<string, number> | undefined;
      if (isSummary) {
        projection = {
          id: 1,
          ownerId: 1,
          title: 1,
          type: 1,
          eventDate: 1,
          guestCount: 1,
          location: 1,
          description: 1,
          status: 1,
          'budget.currency': 1,
          'budget.totalBudget': 1,
          'timeline.id': 1,
          'timeline.isCompleted': 1,
          aiPlanStatus: 1,
          aiSuggestionsGenerated: 1,
          createdAt: 1,
          updatedAt: 1,
        };
      }

      const q = EventModel.find(query, projection)
        .sort({ createdAt: -1 })
        .skip(skip);

      if (filter?.limit !== undefined || isSummary) {
        q.limit(limit);
      }

      const docs = await q.lean();
      return (docs as EventType[]) || [];
    }

    let all = Array.from(memoryEvents.values()).filter((e) => e.ownerId === ownerId);
    if (filter?.type) {
      all = all.filter((e) => e.type === filter.type);
    }
    if (filter?.status) {
      all = all.filter((e) => e.status === filter.status);
    }
    // Sort descending by createdAt
    const sorted = all
      .map((e) => JSON.parse(JSON.stringify(e)))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const sliced = filter?.skip || filter?.limit ? sorted.slice(skip, skip + limit) : sorted;

    if (isSummary) {
      return sliced.map((e) => ({
        id: e.id,
        ownerId: e.ownerId,
        title: e.title,
        type: e.type,
        eventDate: e.eventDate,
        guestCount: e.guestCount,
        location: e.location,
        description: e.description,
        status: e.status,
        budget: {
          currency: e.budget?.currency,
          totalBudget: e.budget?.totalBudget,
          items: [],
        },
        timeline: (e.timeline || []).map((t: any) => ({
          id: t.id,
          title: t.title,
          dueDate: t.dueDate,
          isCompleted: t.isCompleted,
        })),
        vendors: [],
        ideas: [],
        aiSuggestionsGenerated: e.aiSuggestionsGenerated,
        aiPlanStatus: e.aiPlanStatus,
        aiPlanStartedAt: e.aiPlanStartedAt || null,
        aiPlanCompletedAt: e.aiPlanCompletedAt || null,
        aiPlanError: e.aiPlanError || null,
        aiPlanRetryCount: e.aiPlanRetryCount || 0,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })) as EventType[];
    }

    return sliced;
  },

  async update(id: string, ownerId: string, updates: Partial<EventType>): Promise<EventType | null> {
    const updatedAt = new Date().toISOString();
    // Defense-in-depth: strictly allowlist mutable event domain fields, preventing modification
    // of protected identity and lifecycle fields (id, ownerId, createdAt, aiPlan* metadata)
    const allowedKeys: (keyof EventType)[] = [
      'title',
      'type',
      'eventDate',
      'guestCount',
      'location',
      'description',
      'status',
      'budget',
      'timeline',
      'vendors',
      'ideas',
      'aiSuggestionsGenerated',
    ];
    const safeUpdates: Partial<EventType> = {};
    for (const key of allowedKeys) {
      if (key in updates && (updates as Record<string, unknown>)[key] !== undefined) {
        (safeUpdates as Record<string, unknown>)[key] = (updates as Record<string, unknown>)[key];
      }
    }
    const payload = { ...safeUpdates, updatedAt };

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id, ownerId },
        { $set: payload },
        { returnDocument: 'after', lean: true }
      );
      return (updated as EventType) || null;
    }

    const existing = memoryEvents.get(id);
    if (!existing || existing.ownerId !== ownerId) return null;

    const merged: EventType = {
      ...existing,
      ...payload,
      updatedAt,
    };
    memoryEvents.set(id, merged);
    return JSON.parse(JSON.stringify(merged));
  },

  async delete(id: string, ownerId: string): Promise<boolean> {
    if (isDbConnected()) {
      const res = await EventModel.deleteOne({ id, ownerId });
      return (res.deletedCount ?? 0) > 0;
    }
    const existing = memoryEvents.get(id);
    if (!existing || existing.ownerId !== ownerId) {
      return false;
    }
    return memoryEvents.delete(id);
  },

  async clear(): Promise<void> {
    if (isDbConnected()) {
      await EventModel.deleteMany({});
    }
    memoryEvents.clear();
  },

  // ─── Targeted Sub-Resource Operations: Budget Items ──────────────────────────

  async addBudgetItem(
    eventId: string,
    ownerId: string,
    item: BudgetItem
  ): Promise<AddSubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId },
        {
          $push: { 'budget.items': item },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );
      if (!updated) {
        return { status: 'EVENT_NOT_FOUND' };
      }
      return { status: 'SUCCESS', data: updated as EventType };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }
    const updated: EventType = {
      ...existing,
      budget: {
        ...existing.budget,
        items: [...existing.budget.items, item],
      },
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async updateBudgetItem(
    eventId: string,
    ownerId: string,
    itemId: string,
    updates: UpdateBudgetItemInput
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const setFields: Record<string, unknown> = { updatedAt };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setFields[`budget.items.$[elem].${key}`] = value;
        }
      }

      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'budget.items.id': itemId },
        { $set: setFields },
        {
          arrayFilters: [{ 'elem.id': itemId }],
          returnDocument: 'after',
          lean: true,
        }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const index = existing.budget.items.findIndex((i: BudgetItem) => i.id === itemId);
    if (index === -1) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const newItems = [...existing.budget.items];
    newItems[index] = { ...newItems[index], ...updates };

    const updated: EventType = {
      ...existing,
      budget: {
        ...existing.budget,
        items: newItems,
      },
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async deleteBudgetItem(
    eventId: string,
    ownerId: string,
    itemId: string
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'budget.items.id': itemId },
        {
          $pull: { 'budget.items': { id: itemId } },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const itemExists = existing.budget.items.some((i: BudgetItem) => i.id === itemId);
    if (!itemExists) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const updated: EventType = {
      ...existing,
      budget: {
        ...existing.budget,
        items: existing.budget.items.filter((i: BudgetItem) => i.id !== itemId),
      },
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  // ─── Targeted Sub-Resource Operations: Timeline Milestones ───────────────────

  async addTimelineItem(
    eventId: string,
    ownerId: string,
    item: TimelineItem
  ): Promise<AddSubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId },
        {
          $push: { timeline: item },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );
      if (!updated) {
        return { status: 'EVENT_NOT_FOUND' };
      }
      return { status: 'SUCCESS', data: updated as EventType };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }
    const updated: EventType = {
      ...existing,
      timeline: [...existing.timeline, item],
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async updateTimelineItem(
    eventId: string,
    ownerId: string,
    itemId: string,
    updates: UpdateTimelineItemInput
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const setFields: Record<string, unknown> = { updatedAt };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setFields[`timeline.$[elem].${key}`] = value;
        }
      }

      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'timeline.id': itemId },
        { $set: setFields },
        {
          arrayFilters: [{ 'elem.id': itemId }],
          returnDocument: 'after',
          lean: true,
        }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const index = existing.timeline.findIndex((t: TimelineItem) => t.id === itemId);
    if (index === -1) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const newTimeline = [...existing.timeline];
    newTimeline[index] = { ...newTimeline[index], ...updates };

    const updated: EventType = {
      ...existing,
      timeline: newTimeline,
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async deleteTimelineItem(
    eventId: string,
    ownerId: string,
    itemId: string
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'timeline.id': itemId },
        {
          $pull: { timeline: { id: itemId } },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const itemExists = existing.timeline.some((t: TimelineItem) => t.id === itemId);
    if (!itemExists) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const updated: EventType = {
      ...existing,
      timeline: existing.timeline.filter((t: TimelineItem) => t.id !== itemId),
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  // ─── Targeted Sub-Resource Operations: Vendors ───────────────────────────────

  async addVendor(
    eventId: string,
    ownerId: string,
    vendor: Vendor
  ): Promise<AddSubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId },
        {
          $push: { vendors: vendor },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );
      if (!updated) {
        return { status: 'EVENT_NOT_FOUND' };
      }
      return { status: 'SUCCESS', data: updated as EventType };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }
    const updated: EventType = {
      ...existing,
      vendors: [...existing.vendors, vendor],
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async updateVendor(
    eventId: string,
    ownerId: string,
    vendorId: string,
    updates: UpdateVendorInput
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const setFields: Record<string, unknown> = { updatedAt };
      for (const [key, value] of Object.entries(updates)) {
        if (value !== undefined) {
          setFields[`vendors.$[elem].${key}`] = value;
        }
      }

      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'vendors.id': vendorId },
        { $set: setFields },
        {
          arrayFilters: [{ 'elem.id': vendorId }],
          returnDocument: 'after',
          lean: true,
        }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const index = existing.vendors.findIndex((v: Vendor) => v.id === vendorId);
    if (index === -1) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const newVendors = [...existing.vendors];
    newVendors[index] = { ...newVendors[index], ...updates };

    const updated: EventType = {
      ...existing,
      vendors: newVendors,
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async deleteVendor(
    eventId: string,
    ownerId: string,
    vendorId: string
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'vendors.id': vendorId },
        {
          $pull: { vendors: { id: vendorId } },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const vendorExists = existing.vendors.some((v: Vendor) => v.id === vendorId);
    if (!vendorExists) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const updated: EventType = {
      ...existing,
      vendors: existing.vendors.filter((v: Vendor) => v.id !== vendorId),
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  // ─── Targeted Sub-Resource Operations: Ideas ─────────────────────────────────

  async addIdea(
    eventId: string,
    ownerId: string,
    idea: AiIdea
  ): Promise<AddSubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId },
        {
          $push: { ideas: idea },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );
      if (!updated) {
        return { status: 'EVENT_NOT_FOUND' };
      }
      return { status: 'SUCCESS', data: updated as EventType };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }
    const updated: EventType = {
      ...existing,
      ideas: [...existing.ideas, idea],
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  async deleteIdea(
    eventId: string,
    ownerId: string,
    ideaId: string
  ): Promise<SubResourceResult> {
    const updatedAt = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id: eventId, ownerId, 'ideas.id': ideaId },
        {
          $pull: { ideas: { id: ideaId } },
          $set: { updatedAt },
        },
        { returnDocument: 'after', lean: true }
      );

      if (updated) {
        return { status: 'SUCCESS', data: updated as EventType };
      }

      const eventExists = Boolean(await EventModel.exists({ id: eventId, ownerId }));
      return { status: eventExists ? 'ITEM_NOT_FOUND' : 'EVENT_NOT_FOUND' };
    }

    const existing = memoryEvents.get(eventId);
    if (!existing || existing.ownerId !== ownerId) {
      return { status: 'EVENT_NOT_FOUND' };
    }

    const ideaExists = existing.ideas.some((i: AiIdea) => i.id === ideaId);
    if (!ideaExists) {
      return { status: 'ITEM_NOT_FOUND' };
    }

    const updated: EventType = {
      ...existing,
      ideas: existing.ideas.filter((i: AiIdea) => i.id !== ideaId),
      updatedAt,
    };
    memoryEvents.set(eventId, updated);
    return { status: 'SUCCESS', data: JSON.parse(JSON.stringify(updated)) };
  },

  // ─── AI PLAN ASYNC LIFECYCLE ────────────────────────────────────────────────

  /**
   * Atomically claims an event for AI plan generation.
   * Prevents concurrent regeneration requests from causing uncontrolled duplicate AI calls.
   * If already 'processing' within the stale threshold, returns null (lock denied).
   */
  async claimAiPlanGeneration(
    id: string,
    ownerId: string,
    staleThresholdMs = 120_000
  ): Promise<EventType | null> {
    const now = new Date();
    const nowISO = now.toISOString();
    const staleTimeISO = new Date(now.getTime() - staleThresholdMs).toISOString();

    if (isDbConnected()) {
      const doc = await EventModel.findOneAndUpdate(
        {
          id,
          ownerId,
          $or: [
            { aiPlanStatus: { $in: ['pending', 'failed'] } },
            {
              aiPlanStatus: 'processing',
              $or: [
                { aiPlanStartedAt: { $lt: staleTimeISO } },
                { aiPlanStartedAt: null },
                { aiPlanStartedAt: { $exists: false } },
              ],
            },
          ],
        },
        {
          $set: {
            aiPlanStatus: 'processing',
            aiPlanStartedAt: nowISO,
            aiPlanError: null,
            updatedAt: nowISO,
          },
          $inc: { aiPlanRetryCount: 1 },
        },
        { returnDocument: 'after', lean: true }
      );
      return (doc as EventType) || null;
    }

    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;

    const isStale =
      event.aiPlanStatus === 'processing' &&
      event.aiPlanStartedAt &&
      now.getTime() - new Date(event.aiPlanStartedAt).getTime() > staleThresholdMs;

    const canClaim =
      event.aiPlanStatus === 'pending' ||
      event.aiPlanStatus === 'failed' ||
      !event.aiPlanStatus ||
      isStale;

    if (!canClaim) return null;

    event.aiPlanStatus = 'processing';
    event.aiPlanStartedAt = nowISO;
    event.aiPlanError = null;
    event.aiPlanRetryCount = (event.aiPlanRetryCount || 0) + 1;
    event.updatedAt = nowISO;
    return JSON.parse(JSON.stringify(event));
  },

  /**
   * Atomically completes the AI plan, persisting generated ideas, timeline, and vendors.
   * Preserves any existing custom budget items already defined.
   */
  async completeAiPlan(
    id: string,
    ownerId: string,
    plan: {
      ideas: AiIdea[];
      timeline: TimelineItem[];
      vendors: Vendor[];
      budgetItems?: BudgetItem[];
    }
  ): Promise<EventType | null> {
    const nowISO = new Date().toISOString();

    if (isDbConnected()) {
      const existing = await EventModel.findOne({ id, ownerId }).lean();
      if (!existing) return null;

      const existingItems = existing.budget?.items || [];
      const shouldFillBudget = existingItems.length === 0 && Boolean(plan.budgetItems && plan.budgetItems.length > 0);

      // Preserve any custom milestones or vendors added by user while AI generation was in-flight
      const existingTimeline: TimelineItem[] = existing.timeline || [];
      const userCustomTimeline = existingTimeline.filter(
        (existingItem: TimelineItem) => !plan.timeline.some((aiItem) => aiItem.id === existingItem.id)
      );
      const mergedTimeline = [...plan.timeline, ...userCustomTimeline];

      const existingVendors: Vendor[] = existing.vendors || [];
      const userCustomVendors = existingVendors.filter(
        (existingVendor: Vendor) => !existingVendor.isAiSuggested
      );
      const mergedVendors = [...plan.vendors, ...userCustomVendors];

      const updatePayload: Record<string, unknown> = {
        ideas: plan.ideas,
        timeline: mergedTimeline,
        vendors: mergedVendors,
        aiSuggestionsGenerated: true,
        aiPlanStatus: 'completed',
        aiPlanCompletedAt: nowISO,
        aiPlanError: null,
        updatedAt: nowISO,
      };

      if (shouldFillBudget && plan.budgetItems) {
        updatePayload['budget.items'] = plan.budgetItems;
      }

      const updated = await EventModel.findOneAndUpdate(
        { id, ownerId },
        { $set: updatePayload },
        { returnDocument: 'after', lean: true }
      );
      return (updated as EventType) || null;
    }

    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;

    const existingItems = event.budget?.items || [];
    const shouldFillBudget = existingItems.length === 0 && Boolean(plan.budgetItems && plan.budgetItems.length > 0);

    // Preserve any custom milestones or vendors added by user while AI generation was in-flight
    const existingTimeline = event.timeline || [];
    const userCustomTimeline = existingTimeline.filter(
      (existingItem: TimelineItem) => !plan.timeline.some((aiItem: TimelineItem) => aiItem.id === existingItem.id)
    );
    event.timeline = [...plan.timeline, ...userCustomTimeline];

    const existingVendors = event.vendors || [];
    const userCustomVendors = existingVendors.filter(
      (existingVendor: Vendor) => !existingVendor.isAiSuggested
    );
    event.vendors = [...plan.vendors, ...userCustomVendors];

    event.ideas = plan.ideas;
    if (shouldFillBudget && plan.budgetItems) {
      event.budget.items = plan.budgetItems;
    }
    event.aiSuggestionsGenerated = true;
    event.aiPlanStatus = 'completed';
    event.aiPlanCompletedAt = nowISO;
    event.aiPlanError = null;
    event.updatedAt = nowISO;

    return JSON.parse(JSON.stringify(event));
  },

  /**
   * Records failure on AI plan generation without losing the user's saved event.
   */
  async failAiPlan(id: string, ownerId: string, errorMessage: string): Promise<EventType | null> {
    const nowISO = new Date().toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        { id, ownerId },
        {
          $set: {
            aiPlanStatus: 'failed',
            aiPlanError: errorMessage.slice(0, 1000),
            aiPlanCompletedAt: nowISO,
            updatedAt: nowISO,
          },
        },
        { returnDocument: 'after', lean: true }
      );
      return (updated as EventType) || null;
    }

    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;

    event.aiPlanStatus = 'failed';
    event.aiPlanError = errorMessage.slice(0, 1000);
    event.aiPlanCompletedAt = nowISO;
    event.updatedAt = nowISO;

    return JSON.parse(JSON.stringify(event));
  },

  /**
   * Resets an event's AI plan status to 'pending' for user-triggered or automatic retry.
   */
  async resetAiPlanForRetry(
    id: string,
    ownerId: string,
    staleThresholdMs = 120_000
  ): Promise<EventType | null> {
    const now = new Date();
    const nowISO = now.toISOString();
    const staleTimeISO = new Date(now.getTime() - staleThresholdMs).toISOString();

    if (isDbConnected()) {
      const updated = await EventModel.findOneAndUpdate(
        {
          id,
          ownerId,
          $or: [
            { aiPlanStatus: { $in: ['failed', 'completed'] } },
            {
              aiPlanStatus: { $in: ['pending', 'processing'] },
              $or: [
                { aiPlanStartedAt: { $lt: staleTimeISO } },
                { aiPlanStartedAt: null },
                { aiPlanStartedAt: { $exists: false } },
              ],
            },
          ],
        },
        {
          $set: {
            aiPlanStatus: 'pending',
            aiPlanError: null,
            updatedAt: nowISO,
          },
        },
        { returnDocument: 'after', lean: true }
      );
      return (updated as EventType) || null;
    }

    const event = memoryEvents.get(id);
    if (!event || event.ownerId !== ownerId) return null;

    const isStale =
      (event.aiPlanStatus === 'processing' || event.aiPlanStatus === 'pending') &&
      event.aiPlanStartedAt &&
      now.getTime() - new Date(event.aiPlanStartedAt).getTime() > staleThresholdMs;

    const canReset =
      event.aiPlanStatus === 'failed' ||
      event.aiPlanStatus === 'completed' ||
      isStale;

    if (!canReset) {
      return null;
    }

    event.aiPlanStatus = 'pending';
    event.aiPlanError = null;
    event.updatedAt = nowISO;
    return JSON.parse(JSON.stringify(event));
  },

  /**
   * Finds pending or stale in-flight AI plans needing background recovery across server restarts.
   */
  async findPendingOrStaleAiPlans(staleThresholdMs = 120_000, limit = 20): Promise<EventType[]> {
    const staleTimeISO = new Date(Date.now() - staleThresholdMs).toISOString();

    if (isDbConnected()) {
      const docs = await EventModel.find({
        $or: [
          { aiPlanStatus: 'pending' },
          {
            aiPlanStatus: 'processing',
            $or: [
              { aiPlanStartedAt: { $lt: staleTimeISO } },
              { aiPlanStartedAt: null },
              { aiPlanStartedAt: { $exists: false } },
            ],
          },
        ],
        aiPlanRetryCount: { $lt: 3 },
      })
        .limit(limit)
        .lean();
      return (docs as EventType[]) || [];
    }

    const now = Date.now();
    const candidates = Array.from(memoryEvents.values()).filter((e) => {
      if ((e.aiPlanRetryCount || 0) >= 3) return false;
      if (e.aiPlanStatus === 'pending') return true;
      if (e.aiPlanStatus === 'processing') {
        if (!e.aiPlanStartedAt) return true;
        return now - new Date(e.aiPlanStartedAt).getTime() > staleThresholdMs;
      }
      return false;
    });

    return candidates.slice(0, limit).map((e) => JSON.parse(JSON.stringify(e)));
  },
};
