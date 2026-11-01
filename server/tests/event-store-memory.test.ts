import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type {
  Event as EventType,
  BudgetItem,
  TimelineItem,
  Vendor,
  AiIdea,
} from '@celebration-planner/shared';

// Force the in-memory adapter so these tests never touch MongoDB, whatever .env contains.
vi.mock('../src/db/connection.js', () => ({ useMongoStorage: () => false }));

const { eventStore } = await import('../src/services/eventStore.js');

const OWNER = 'owner-a';
const OTHER = 'owner-b';
const EVENT_ID = 'evt-store-1';
const FIXED_NOW = '2031-03-04T05:06:07.000Z';

const budgetItem = (id: string): BudgetItem => ({
  id,
  category: 'Venue',
  estimatedAmount: 100,
  actualAmount: 0,
  notes: 'n',
  isPaid: false,
});
const timelineItem = (id: string): TimelineItem => ({
  id,
  title: `Task ${id}`,
  description: '',
  dueDate: '2031-01-01T00:00:00.000Z',
  isCompleted: false,
  category: 'Milestone',
});
const vendor = (id: string, isAiSuggested = false): Vendor => ({
  id,
  name: `Vendor ${id}`,
  category: 'Catering',
  status: 'not_contacted',
  estimatedCost: 50,
  notes: '',
  isAiSuggested,
});
const idea = (id: string): AiIdea => ({
  id,
  category: 'Theme & Aesthetic',
  title: `Idea ${id}`,
  description: 'd',
  tags: ['a'],
});

function makeEvent(overrides: Partial<EventType> = {}): EventType {
  return {
    id: EVENT_ID,
    ownerId: OWNER,
    title: 'Store Test Event',
    type: 'birthday',
    eventDate: '2031-06-01T18:00:00.000Z',
    guestCount: 20,
    location: 'Hall',
    status: 'planning',
    budget: { currency: 'USD', totalBudget: 1000, items: [budgetItem('b1')] },
    timeline: [timelineItem('t1')],
    vendors: [vendor('v1')],
    ideas: [idea('i1')],
    aiSuggestionsGenerated: false,
    aiPlanStatus: 'pending',
    aiPlanRetryCount: 0,
    createdAt: '2031-01-01T00:00:00.000Z',
    updatedAt: '2031-01-01T00:00:00.000Z',
    ...overrides,
  } as EventType;
}

describe('eventStore (in-memory adapter)', () => {
  beforeEach(async () => {
    await eventStore.clear();
    await eventStore.create(makeEvent());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── Ownership & cross-user isolation ────────────────────────────────────────
  describe('ownership', () => {
    const subResourceOps: Array<[string, (id: string, owner: string) => Promise<{ status: string }>]> = [
      ['addBudgetItem', (id, o) => eventStore.addBudgetItem(id, o, budgetItem('bx'))],
      ['updateBudgetItem', (id, o) => eventStore.updateBudgetItem(id, o, 'b1', { notes: 'x' })],
      ['deleteBudgetItem', (id, o) => eventStore.deleteBudgetItem(id, o, 'b1')],
      ['addTimelineItem', (id, o) => eventStore.addTimelineItem(id, o, timelineItem('tx'))],
      ['updateTimelineItem', (id, o) => eventStore.updateTimelineItem(id, o, 't1', { isCompleted: true })],
      ['deleteTimelineItem', (id, o) => eventStore.deleteTimelineItem(id, o, 't1')],
      ['addVendor', (id, o) => eventStore.addVendor(id, o, vendor('vx'))],
      ['updateVendor', (id, o) => eventStore.updateVendor(id, o, 'v1', { notes: 'x' })],
      ['deleteVendor', (id, o) => eventStore.deleteVendor(id, o, 'v1')],
      ['addIdea', (id, o) => eventStore.addIdea(id, o, idea('ix'))],
      ['deleteIdea', (id, o) => eventStore.deleteIdea(id, o, 'i1')],
    ];

    it.each(subResourceOps)('%s returns EVENT_NOT_FOUND for another owner and changes nothing', async (_n, op) => {
      const before = await eventStore.findById(EVENT_ID, OWNER);
      expect((await op(EVENT_ID, OTHER)).status).toBe('EVENT_NOT_FOUND');
      expect(await eventStore.findById(EVENT_ID, OWNER)).toEqual(before);
    });

    it.each(subResourceOps)('%s returns EVENT_NOT_FOUND for an unknown event id', async (_n, op) => {
      expect((await op('missing-id', OWNER)).status).toBe('EVENT_NOT_FOUND');
    });

    it('findById, findAiStatus, update and delete deny other owners', async () => {
      const before = await eventStore.findById(EVENT_ID, OWNER);
      expect(await eventStore.findById(EVENT_ID, OTHER)).toBeNull();
      expect(await eventStore.findAiStatus(EVENT_ID, OTHER)).toBeNull();
      expect(await eventStore.update(EVENT_ID, OTHER, { title: 'Hijacked' })).toBeNull();
      expect(await eventStore.delete(EVENT_ID, OTHER)).toBe(false);
      expect(await eventStore.findById(EVENT_ID, OWNER)).toEqual(before);
    });

    it('AI lifecycle methods deny other owners and change nothing', async () => {
      const before = await eventStore.findById(EVENT_ID, OWNER);
      expect(await eventStore.claimAiPlanGeneration(EVENT_ID, OTHER)).toBeNull();
      expect(
        await eventStore.completeAiPlan(EVENT_ID, OTHER, { ideas: [], timeline: [], vendors: [] })
      ).toBeNull();
      expect(await eventStore.failAiPlan(EVENT_ID, OTHER, 'boom')).toBeNull();
      expect(await eventStore.resetAiPlanForRetry(EVENT_ID, OTHER)).toBeNull();
      expect(await eventStore.findById(EVENT_ID, OWNER)).toEqual(before);
    });

    it('findAll only returns the requesting owner events', async () => {
      await eventStore.create(makeEvent({ id: 'evt-other', ownerId: OTHER }));
      const mine = await eventStore.findAll(OWNER);
      expect(mine.map((e) => e.id)).toEqual([EVENT_ID]);
    });
  });

  // ─── Item-level results ──────────────────────────────────────────────────────
  describe('item-level results', () => {
    it.each([
      ['updateBudgetItem', () => eventStore.updateBudgetItem(EVENT_ID, OWNER, 'nope', { notes: 'x' })],
      ['deleteBudgetItem', () => eventStore.deleteBudgetItem(EVENT_ID, OWNER, 'nope')],
      ['updateTimelineItem', () => eventStore.updateTimelineItem(EVENT_ID, OWNER, 'nope', { isCompleted: true })],
      ['deleteTimelineItem', () => eventStore.deleteTimelineItem(EVENT_ID, OWNER, 'nope')],
      ['updateVendor', () => eventStore.updateVendor(EVENT_ID, OWNER, 'nope', { notes: 'x' })],
      ['deleteVendor', () => eventStore.deleteVendor(EVENT_ID, OWNER, 'nope')],
      ['deleteIdea', () => eventStore.deleteIdea(EVENT_ID, OWNER, 'nope')],
    ])('%s returns ITEM_NOT_FOUND for an unknown item id', async (_n, op) => {
      expect((await op()).status).toBe('ITEM_NOT_FOUND');
    });

    it('adds, updates and deletes each sub-resource and returns the full updated event', async () => {
      const added = await eventStore.addBudgetItem(EVENT_ID, OWNER, budgetItem('b2'));
      expect(added.status === 'SUCCESS' && added.data.budget.items.map((i) => i.id)).toEqual(['b1', 'b2']);

      const updated = await eventStore.updateBudgetItem(EVENT_ID, OWNER, 'b2', { notes: 'changed', isPaid: true });
      expect(updated.status).toBe('SUCCESS');
      if (updated.status === 'SUCCESS') {
        const item = updated.data.budget.items.find((i) => i.id === 'b2')!;
        expect(item).toMatchObject({ notes: 'changed', isPaid: true, category: 'Venue' });
        expect(updated.data.budget.items.find((i) => i.id === 'b1')!.notes).toBe('n');
      }

      const removed = await eventStore.deleteBudgetItem(EVENT_ID, OWNER, 'b1');
      expect(removed.status === 'SUCCESS' && removed.data.budget.items.map((i) => i.id)).toEqual(['b2']);

      const tl = await eventStore.updateTimelineItem(EVENT_ID, OWNER, 't1', { isCompleted: true });
      expect(tl.status === 'SUCCESS' && tl.data.timeline[0].isCompleted).toBe(true);
      const vd = await eventStore.deleteVendor(EVENT_ID, OWNER, 'v1');
      expect(vd.status === 'SUCCESS' && vd.data.vendors).toEqual([]);
      const id = await eventStore.deleteIdea(EVENT_ID, OWNER, 'i1');
      expect(id.status === 'SUCCESS' && id.data.ideas).toEqual([]);
    });

    it('persists sub-resource changes for later reads', async () => {
      await eventStore.addVendor(EVENT_ID, OWNER, vendor('v2'));
      await eventStore.addTimelineItem(EVENT_ID, OWNER, timelineItem('t2'));
      const stored = await eventStore.findById(EVENT_ID, OWNER);
      expect(stored!.vendors.map((v) => v.id)).toEqual(['v1', 'v2']);
      expect(stored!.timeline.map((t) => t.id)).toEqual(['t1', 't2']);
    });

    it('ignores undefined update properties and preserves existing values in in-memory updates', async () => {
      // 1. Budget item: existing notes 'n', update with notes: undefined
      const budgetRes = await eventStore.updateBudgetItem(EVENT_ID, OWNER, 'b1', {
        notes: undefined,
        isPaid: true,
      });
      expect(budgetRes.status).toBe('SUCCESS');
      if (budgetRes.status === 'SUCCESS') {
        const item = budgetRes.data.budget.items.find((b) => b.id === 'b1')!;
        expect(item.notes).toBe('n');
        expect(item.isPaid).toBe(true);
      }

      // 2. Timeline item: existing description '', update with description: undefined
      const timelineRes = await eventStore.updateTimelineItem(EVENT_ID, OWNER, 't1', {
        description: undefined,
        isCompleted: true,
      });
      expect(timelineRes.status).toBe('SUCCESS');
      if (timelineRes.status === 'SUCCESS') {
        const item = timelineRes.data.timeline.find((t) => t.id === 't1')!;
        expect(item.description).toBe('');
        expect(item.isCompleted).toBe(true);
      }

      // 3. Vendor: existing notes '', update with notes: undefined
      const vendorRes = await eventStore.updateVendor(EVENT_ID, OWNER, 'v1', {
        notes: undefined,
        status: 'contacted',
      });
      expect(vendorRes.status).toBe('SUCCESS');
      if (vendorRes.status === 'SUCCESS') {
        const item = vendorRes.data.vendors.find((v) => v.id === 'v1')!;
        expect(item.notes).toBe('');
        expect(item.status).toBe('contacted');
      }
    });
  });

  // ─── Timestamps ──────────────────────────────────────────────────────────────
  describe('timestamps', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(FIXED_NOW));
    });

    it('sets updatedAt (ISO) and keeps createdAt on every sub-resource mutation', async () => {
      const results = [
        await eventStore.addBudgetItem(EVENT_ID, OWNER, budgetItem('b2')),
        await eventStore.updateBudgetItem(EVENT_ID, OWNER, 'b2', { notes: 'x' }),
        await eventStore.deleteBudgetItem(EVENT_ID, OWNER, 'b2'),
        await eventStore.addTimelineItem(EVENT_ID, OWNER, timelineItem('t2')),
        await eventStore.updateTimelineItem(EVENT_ID, OWNER, 't2', { isCompleted: true }),
        await eventStore.deleteTimelineItem(EVENT_ID, OWNER, 't2'),
        await eventStore.addVendor(EVENT_ID, OWNER, vendor('v2')),
        await eventStore.updateVendor(EVENT_ID, OWNER, 'v2', { notes: 'x' }),
        await eventStore.deleteVendor(EVENT_ID, OWNER, 'v2'),
        await eventStore.addIdea(EVENT_ID, OWNER, idea('i2')),
        await eventStore.deleteIdea(EVENT_ID, OWNER, 'i2'),
      ];
      for (const r of results) {
        expect(r.status).toBe('SUCCESS');
        if (r.status === 'SUCCESS') {
          expect(r.data.updatedAt).toBe(FIXED_NOW);
          expect(r.data.createdAt).toBe('2031-01-01T00:00:00.000Z');
        }
      }
    });

    it('update() sets updatedAt and ignores protected fields', async () => {
      const updated = await eventStore.update(EVENT_ID, OWNER, {
        title: 'Renamed',
        ownerId: OTHER,
        id: 'hijack',
        createdAt: 'x',
      } as Partial<EventType>);
      expect(updated).toMatchObject({
        id: EVENT_ID,
        ownerId: OWNER,
        title: 'Renamed',
        createdAt: '2031-01-01T00:00:00.000Z',
        updatedAt: FIXED_NOW,
      });
    });

    it('AI lifecycle methods set updatedAt', async () => {
      expect((await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER))!.updatedAt).toBe(FIXED_NOW);
      expect(
        (await eventStore.completeAiPlan(EVENT_ID, OWNER, { ideas: [], timeline: [], vendors: [] }))!.updatedAt
      ).toBe(FIXED_NOW);
      expect((await eventStore.failAiPlan(EVENT_ID, OWNER, 'x'))!.updatedAt).toBe(FIXED_NOW);
      expect((await eventStore.resetAiPlanForRetry(EVENT_ID, OWNER))!.updatedAt).toBe(FIXED_NOW);
    });
  });

  // ─── Cloning / isolation ─────────────────────────────────────────────────────
  describe('cloning', () => {
    it('create() stores a copy: mutating the input afterwards does not change the store', async () => {
      const input = makeEvent({ id: 'evt-clone' });
      await eventStore.create(input);
      input.title = 'Mutated after create';
      input.budget.items.push(budgetItem('leak'));
      const stored = await eventStore.findById('evt-clone', OWNER);
      expect(stored!.title).toBe('Store Test Event');
      expect(stored!.budget.items.map((i) => i.id)).toEqual(['b1']);
    });

    it('findById returns an independent copy each time', async () => {
      const first = (await eventStore.findById(EVENT_ID, OWNER))!;
      first.title = 'Mutated';
      first.vendors.length = 0;
      const second = (await eventStore.findById(EVENT_ID, OWNER))!;
      expect(second.title).toBe('Store Test Event');
      expect(second.vendors).toHaveLength(1);
      expect(second).not.toBe(first);
    });

    it('sub-resource and AI results are copies of stored state', async () => {
      const res = await eventStore.addIdea(EVENT_ID, OWNER, idea('i2'));
      if (res.status === 'SUCCESS') res.data.ideas.length = 0;
      expect((await eventStore.findById(EVENT_ID, OWNER))!.ideas).toHaveLength(2);

      const claimed = (await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER))!;
      claimed.title = 'Mutated';
      expect((await eventStore.findById(EVENT_ID, OWNER))!.title).toBe('Store Test Event');
    });

    it('findAll returns copies and findAll summary strips heavy arrays', async () => {
      const list = await eventStore.findAll(OWNER);
      list[0].title = 'Mutated';
      expect((await eventStore.findById(EVENT_ID, OWNER))!.title).toBe('Store Test Event');

      const [summary] = await eventStore.findAll(OWNER, { summary: true });
      expect(summary.vendors).toEqual([]);
      expect(summary.ideas).toEqual([]);
      expect(summary.budget.items).toEqual([]);
      expect(summary.timeline[0]).toEqual({
        id: 't1',
        title: 'Task t1',
        dueDate: '2031-01-01T00:00:00.000Z',
        isCompleted: false,
      });
    });
  });

  // ─── AI plan lifecycle ───────────────────────────────────────────────────────
  describe('AI plan lifecycle', () => {
    it('claim moves pending to processing, increments retries, and denies a second claim', async () => {
      const claimed = await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER);
      expect(claimed).toMatchObject({ aiPlanStatus: 'processing', aiPlanRetryCount: 1, aiPlanError: null });
      expect(claimed!.aiPlanStartedAt).toBeTruthy();
      expect(await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER)).toBeNull();
    });

    it('claim succeeds on a stale processing event but not a fresh one', async () => {
      await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER);
      expect(await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER, 60_000)).toBeNull();
      await new Promise((r) => setTimeout(r, 5));
      const reclaimed = await eventStore.claimAiPlanGeneration(EVENT_ID, OWNER, 1);
      expect(reclaimed).toMatchObject({ aiPlanStatus: 'processing', aiPlanRetryCount: 2 });
    });

    it('complete merges AI results, keeps user-added items, and fills an empty budget only', async () => {
      await eventStore.update(EVENT_ID, OWNER, {
        budget: { currency: 'USD', totalBudget: 1000, items: [] },
        timeline: [timelineItem('custom-t')],
        vendors: [vendor('custom-v'), vendor('old-ai', true)],
      });
      const done = (await eventStore.completeAiPlan(EVENT_ID, OWNER, {
        ideas: [idea('ai-i')],
        timeline: [timelineItem('ai-t')],
        vendors: [vendor('ai-v', true)],
        budgetItems: [budgetItem('ai-b')],
      }))!;
      expect(done).toMatchObject({ aiPlanStatus: 'completed', aiSuggestionsGenerated: true, aiPlanError: null });
      expect(done.ideas.map((i) => i.id)).toEqual(['ai-i']);
      expect(done.timeline.map((t) => t.id)).toEqual(['ai-t', 'custom-t']);
      expect(done.vendors.map((v) => v.id)).toEqual(['ai-v', 'custom-v']);
      expect(done.budget.items.map((b) => b.id)).toEqual(['ai-b']);

      // A second completion must not replace a budget that already has items.
      const again = (await eventStore.completeAiPlan(EVENT_ID, OWNER, {
        ideas: [],
        timeline: [],
        vendors: [],
        budgetItems: [budgetItem('other')],
      }))!;
      expect(again.budget.items.map((b) => b.id)).toEqual(['ai-b']);
    });

    it('fail records the error truncated to 1000 characters', async () => {
      const failed = (await eventStore.failAiPlan(EVENT_ID, OWNER, 'x'.repeat(1500)))!;
      expect(failed.aiPlanStatus).toBe('failed');
      expect(failed.aiPlanError).toHaveLength(1000);
      expect(failed.aiPlanCompletedAt).toBeTruthy();
    });

    it('reset only works from failed/completed (or stale), and clears the error', async () => {
      expect(await eventStore.resetAiPlanForRetry(EVENT_ID, OWNER)).toBeNull(); // pending, not stale
      await eventStore.failAiPlan(EVENT_ID, OWNER, 'boom');
      const reset = await eventStore.resetAiPlanForRetry(EVENT_ID, OWNER);
      expect(reset).toMatchObject({ aiPlanStatus: 'pending', aiPlanError: null });
    });

    it('findAiStatus projects only status fields with safe defaults', async () => {
      expect(await eventStore.findAiStatus(EVENT_ID, OWNER)).toEqual({
        eventId: EVENT_ID,
        aiPlanStatus: 'pending',
        aiPlanError: null,
        aiPlanStartedAt: null,
        aiPlanCompletedAt: null,
        aiPlanRetryCount: 0,
        aiSuggestionsGenerated: false,
      });
    });

    it('findPendingOrStaleAiPlans skips events at 3 retries, honours limit, and returns copies', async () => {
      await eventStore.create(makeEvent({ id: 'evt-maxed', aiPlanRetryCount: 3 }));
      await eventStore.create(makeEvent({ id: 'evt-done', aiPlanStatus: 'completed' }));
      await eventStore.create(makeEvent({ id: 'evt-pending-2' }));

      const found = await eventStore.findPendingOrStaleAiPlans();
      expect(found.map((e) => e.id).sort()).toEqual([EVENT_ID, 'evt-pending-2'].sort());

      expect(await eventStore.findPendingOrStaleAiPlans(120_000, 1)).toHaveLength(1);

      found[0].title = 'Mutated';
      expect((await eventStore.findById(found[0].id, OWNER))!.title).toBe('Store Test Event');
    });
  });
});

