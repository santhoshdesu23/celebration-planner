import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { eventStore } from '../src/services/eventStore.js';
import { aiJobRunner } from '../src/services/aiJobRunner.js';
import { getTestAuthHeader } from './helpers/authHelper.js';

const app = createApp();

const userA = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  email: 'usera@example.com',
  name: 'User A',
};
const userB = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  email: 'userb@example.com',
  name: 'User B',
};

const authHeaderA = getTestAuthHeader(userA);
const authHeaderB = getTestAuthHeader(userB);

const baseEventInput = {
  title: 'Subresource Optimization Gala',
  type: 'gala' as any, // fallback or anniversary
  eventDate: '2028-06-15T18:00:00.000Z',
  guestCount: 200,
  location: 'Metropolitan Hall',
  description: 'Precision benchmark and sub-resource atomic updates',
  budget: {
    currency: 'USD',
    totalBudget: 50000,
    items: [],
  },
};

describe('P2.3 Sub-Resource Targeted Updates & Concurrency Suite', () => {
  beforeEach(async () => {
    await eventStore.clear();
  });

  async function createEventForUserA(extra = {}) {
    const res = await request(app)
      .post('/api/events')
      .set(authHeaderA)
      .send({
        ...baseEventInput,
        type: 'anniversary',
        ...extra,
      });
    expect(res.status).toBe(201);
    const created = res.body.data;
    const completed = await aiJobRunner.waitForJob(created.id, created.ownerId);
    return completed || created;
  }

  // ─── 1. Budget Item Targeted Operations ──────────────────────────────────
  describe('Budget Items Mutation & Authorization', () => {
    it('adds, updates, and deletes budget items with targeted queries', async () => {
      const event = await createEventForUserA();

      // Add item 1
      const addRes = await request(app)
        .post(`/api/events/${event.id}/budget/items`)
        .set(authHeaderA)
        .send({
          category: 'Artisan Catering',
          estimatedAmount: 12000,
          notes: '5-course seasonal menu',
        });
      expect(addRes.status).toBe(201);
      const item1 = addRes.body.data.budget.items.find(
        (i: any) => i.category === 'Artisan Catering'
      );
      expect(item1).toBeDefined();
      expect(item1.id).toBeDefined();
      expect(item1.estimatedAmount).toBe(12000);
      expect(item1.isPaid).toBe(false);

      // Targeted Patch: update actual amount and mark paid
      const patchRes = await request(app)
        .patch(`/api/events/${event.id}/budget/items/${item1.id}`)
        .set(authHeaderA)
        .send({
          actualAmount: 11800,
          isPaid: true,
        });
      expect(patchRes.status).toBe(200);
      const patchedItem1 = patchRes.body.data.budget.items.find((i: any) => i.id === item1.id);
      expect(patchedItem1.actualAmount).toBe(11800);
      expect(patchedItem1.isPaid).toBe(true);
      expect(patchedItem1.notes).toBe('5-course seasonal menu'); // Unchanged notes preserved

      // Targeted Delete
      const deleteRes = await request(app)
        .delete(`/api/events/${event.id}/budget/items/${item1.id}`)
        .set(authHeaderA);
      expect(deleteRes.status).toBe(200);
      expect(
        deleteRes.body.data.budget.items.find((i: any) => i.id === item1.id)
      ).toBeUndefined();
    });

    it('returns 404 with exact message when event ID or item ID is missing', async () => {
      const event = await createEventForUserA();

      // Missing Event ID on Add
      const missingEventAdd = await request(app)
        .post('/api/events/non-existent-event-id/budget/items')
        .set(authHeaderA)
        .send({ category: 'Florals', estimatedAmount: 2000 });
      expect(missingEventAdd.status).toBe(404);
      expect(missingEventAdd.body.error.message).toBe('Event not found');

      // Missing Event ID on Patch
      const missingEventPatch = await request(app)
        .patch('/api/events/non-existent-event-id/budget/items/item-123')
        .set(authHeaderA)
        .send({ isPaid: true });
      expect(missingEventPatch.status).toBe(404);
      expect(missingEventPatch.body.error.message).toBe('Event not found');

      // Missing Item ID on Patch (Event exists)
      const missingItemPatch = await request(app)
        .patch(`/api/events/${event.id}/budget/items/non-existent-item-id`)
        .set(authHeaderA)
        .send({ isPaid: true });
      expect(missingItemPatch.status).toBe(404);
      expect(missingItemPatch.body.error.message).toBe('Budget item not found');

      // Missing Event ID on Delete
      const missingEventDelete = await request(app)
        .delete('/api/events/non-existent-event-id/budget/items/item-123')
        .set(authHeaderA);
      expect(missingEventDelete.status).toBe(404);
      expect(missingEventDelete.body.error.message).toBe('Event not found');

      // Missing Item ID on Delete (Event exists)
      const missingItemDelete = await request(app)
        .delete(`/api/events/${event.id}/budget/items/non-existent-item-id`)
        .set(authHeaderA);
      expect(missingItemDelete.status).toBe(404);
      expect(missingItemDelete.body.error.message).toBe('Budget item not found');
    });

    it('enforces ownership: User B cannot modify or delete User A budget items', async () => {
      const event = await createEventForUserA();

      // User A adds an item
      const addRes = await request(app)
        .post(`/api/events/${event.id}/budget/items`)
        .set(authHeaderA)
        .send({ category: 'Lighting', estimatedAmount: 4000 });
      const addedItem = addRes.body.data.budget.items.find((i: any) => i.category === 'Lighting');
      expect(addedItem).toBeDefined();
      const itemId = addedItem.id;

      // User B attempts to patch User A's budget item -> 404 Event not found
      const patchB = await request(app)
        .patch(`/api/events/${event.id}/budget/items/${itemId}`)
        .set(authHeaderB)
        .send({ estimatedAmount: 100 });
      expect(patchB.status).toBe(404);
      expect(patchB.body.error.message).toBe('Event not found');

      // User B attempts to delete User A's budget item -> 404 Event not found
      const deleteB = await request(app)
        .delete(`/api/events/${event.id}/budget/items/${itemId}`)
        .set(authHeaderB);
      expect(deleteB.status).toBe(404);
      expect(deleteB.body.error.message).toBe('Event not found');

      // Verify item remains untouched under User A
      const checkA = await request(app).get(`/api/events/${event.id}`).set(authHeaderA);
      const lightingItem = checkA.body.data.budget.items.find((i: any) => i.id === itemId);
      expect(lightingItem).toBeDefined();
      expect(lightingItem.estimatedAmount).toBe(4000);
    });
  });

  // ─── 2. Timeline Milestone Targeted Operations ────────────────────────────
  describe('Timeline Milestone Targeted Operations', () => {
    it('adds, completes, edits, and deletes timeline milestones atomically', async () => {
      const event = await createEventForUserA();

      // Add milestone
      const addRes = await request(app)
        .post(`/api/events/${event.id}/timeline/items`)
        .set(authHeaderA)
        .send({
          title: 'Sign floral contract',
          dueDate: '2028-01-10T15:00:00.000Z',
          description: 'Ensure orchids and peonies included',
          category: 'Florals',
        });
      expect(addRes.status).toBe(201);
      const milestone = addRes.body.data.timeline.find(
        (t: any) => t.title === 'Sign floral contract'
      );
      expect(milestone).toBeDefined();
      expect(milestone.isCompleted).toBe(false);

      // Complete milestone
      const patchRes = await request(app)
        .patch(`/api/events/${event.id}/timeline/items/${milestone.id}`)
        .set(authHeaderA)
        .send({ isCompleted: true });
      expect(patchRes.status).toBe(200);
      const completedMilestone = patchRes.body.data.timeline.find((t: any) => t.id === milestone.id);
      expect(completedMilestone.isCompleted).toBe(true);

      // Delete milestone
      const delRes = await request(app)
        .delete(`/api/events/${event.id}/timeline/items/${milestone.id}`)
        .set(authHeaderA);
      expect(delRes.status).toBe(200);
      expect(
        delRes.body.data.timeline.find((t: any) => t.id === milestone.id)
      ).toBeUndefined();
    });

    it('returns 404 on missing timeline item ID or event ID', async () => {
      const event = await createEventForUserA();

      const patchMissingItem = await request(app)
        .patch(`/api/events/${event.id}/timeline/items/fake-milestone-id`)
        .set(authHeaderA)
        .send({ isCompleted: true });
      expect(patchMissingItem.status).toBe(404);
      expect(patchMissingItem.body.error.message).toBe('Timeline item not found');

      const deleteMissingItem = await request(app)
        .delete(`/api/events/${event.id}/timeline/items/fake-milestone-id`)
        .set(authHeaderA);
      expect(deleteMissingItem.status).toBe(404);
      expect(deleteMissingItem.body.error.message).toBe('Timeline item not found');
    });

    it('enforces ownership on timeline milestones', async () => {
      const event = await createEventForUserA();
      const milestoneId = event.timeline[0]?.id;
      expect(milestoneId).toBeDefined();

      const patchB = await request(app)
        .patch(`/api/events/${event.id}/timeline/items/${milestoneId}`)
        .set(authHeaderB)
        .send({ isCompleted: true });
      expect(patchB.status).toBe(404);

      const deleteB = await request(app)
        .delete(`/api/events/${event.id}/timeline/items/${milestoneId}`)
        .set(authHeaderB);
      expect(deleteB.status).toBe(404);
    });
  });

  // ─── 3. Vendor Targeted Operations ────────────────────────────────────────
  describe('Vendor Targeted Operations', () => {
    it('adds, updates status, quotes, and deletes vendors atomically', async () => {
      const event = await createEventForUserA();

      // Add vendor
      const addRes = await request(app)
        .post(`/api/events/${event.id}/vendors`)
        .set(authHeaderA)
        .send({
          name: 'SoundWave DJs',
          category: 'Entertainment',
          contactEmail: 'contact@soundwavedjs.com',
          contactPhone: '+1-555-0199',
          estimatedCost: 3500,
        });
      expect(addRes.status).toBe(201);
      const vendor = addRes.body.data.vendors.find((v: any) => v.name === 'SoundWave DJs');
      expect(vendor).toBeDefined();
      expect(vendor.status).toBe('not_contacted');

      // Update vendor status to booked and set confirmed cost
      const patchRes = await request(app)
        .patch(`/api/events/${event.id}/vendors/${vendor.id}`)
        .set(authHeaderA)
        .send({
          status: 'booked',
          confirmedCost: 3200,
          notes: 'Contract signed with deposit paid',
        });
      expect(patchRes.status).toBe(200);
      const bookedVendor = patchRes.body.data.vendors.find((v: any) => v.id === vendor.id);
      expect(bookedVendor.status).toBe('booked');
      expect(bookedVendor.confirmedCost).toBe(3200);
      expect(bookedVendor.notes).toBe('Contract signed with deposit paid');

      // Delete vendor
      const delRes = await request(app)
        .delete(`/api/events/${event.id}/vendors/${vendor.id}`)
        .set(authHeaderA);
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.vendors.find((v: any) => v.id === vendor.id)).toBeUndefined();
    });

    it('returns 404 for missing vendor ID', async () => {
      const event = await createEventForUserA();

      const patchMissing = await request(app)
        .patch(`/api/events/${event.id}/vendors/fake-vendor-id`)
        .set(authHeaderA)
        .send({ status: 'contacted' });
      expect(patchMissing.status).toBe(404);
      expect(patchMissing.body.error.message).toBe('Vendor not found');

      const delMissing = await request(app)
        .delete(`/api/events/${event.id}/vendors/fake-vendor-id`)
        .set(authHeaderA);
      expect(delMissing.status).toBe(404);
      expect(delMissing.body.error.message).toBe('Vendor not found');
    });

    it('enforces ownership on vendor mutations', async () => {
      const event = await createEventForUserA();
      const vendorId = event.vendors[0]?.id;
      expect(vendorId).toBeDefined();

      const patchB = await request(app)
        .patch(`/api/events/${event.id}/vendors/${vendorId}`)
        .set(authHeaderB)
        .send({ status: 'cancelled' });
      expect(patchB.status).toBe(404);

      const deleteB = await request(app)
        .delete(`/api/events/${event.id}/vendors/${vendorId}`)
        .set(authHeaderB);
      expect(deleteB.status).toBe(404);
    });
  });

  // ─── 4. Idea Targeted Operations ──────────────────────────────────────────
  describe('Idea Targeted Operations', () => {
    it('adds and deletes ideas atomically', async () => {
      const event = await createEventForUserA();

      // Add custom idea
      const addRes = await request(app)
        .post(`/api/events/${event.id}/ideas`)
        .set(authHeaderA)
        .send({
          category: 'Lighting',
          title: 'Candlelit Canopy',
          description: 'Hundreds of glass globes suspended from timber beams',
          tags: ['romantic', 'ambiance'],
        });
      expect(addRes.status).toBe(201);
      const idea = addRes.body.data.ideas.find((i: any) => i.title === 'Candlelit Canopy');
      expect(idea).toBeDefined();

      // Delete idea
      const delRes = await request(app)
        .delete(`/api/events/${event.id}/ideas/${idea.id}`)
        .set(authHeaderA);
      expect(delRes.status).toBe(200);
      expect(delRes.body.data.ideas.find((i: any) => i.id === idea.id)).toBeUndefined();
    });

    it('returns 404 for missing idea ID', async () => {
      const event = await createEventForUserA();

      const delMissing = await request(app)
        .delete(`/api/events/${event.id}/ideas/fake-idea-id`)
        .set(authHeaderA);
      expect(delMissing.status).toBe(404);
      expect(delMissing.body.error.message).toBe('Idea not found');
    });
  });

  // ─── 5. Concurrency & Lost-Update Prevention ──────────────────────────────
  describe('Concurrency & Atomic Mutation Integrity', () => {
    it('handles concurrent sub-resource additions without silent overwrites', async () => {
      const event = await createEventForUserA();
      const concurrencyCount = 5;

      const itemsToAdd = Array.from({ length: concurrencyCount }, (_, i) => ({
        category: `Concurrent Expense ${i + 1}`,
        estimatedAmount: 500 * (i + 1),
      }));

      // Fire concurrent requests simultaneously
      const results = await Promise.all(
        itemsToAdd.map((item) =>
          request(app)
            .post(`/api/events/${event.id}/budget/items`)
            .set(authHeaderA)
            .send(item)
        )
      );

      for (const res of results) {
        expect(res.status).toBe(201);
      }

      // Fetch latest state of the event
      const finalRes = await request(app)
        .get(`/api/events/${event.id}`)
        .set(authHeaderA);
      expect(finalRes.status).toBe(200);

      const allItems = finalRes.body.data.budget.items;
      // All 5 concurrent items must exist
      for (const item of itemsToAdd) {
        const found = allItems.find((i: any) => i.category === item.category);
        expect(found).toBeDefined();
        expect(found.estimatedAmount).toBe(item.estimatedAmount);
      }
    });

    it('handles concurrent edits to distinct items without mutual overwrites', async () => {
      const event = await createEventForUserA();

      // Add two items sequentially first
      const item1Res = await request(app)
        .post(`/api/events/${event.id}/budget/items`)
        .set(authHeaderA)
        .send({ category: 'Item Alpha', estimatedAmount: 1000 });
      const item2Res = await request(app)
        .post(`/api/events/${event.id}/budget/items`)
        .set(authHeaderA)
        .send({ category: 'Item Beta', estimatedAmount: 2000 });

      const item1Id = item1Res.body.data.budget.items.find(
        (i: any) => i.category === 'Item Alpha'
      ).id;
      const item2Id = item2Res.body.data.budget.items.find(
        (i: any) => i.category === 'Item Beta'
      ).id;

      // Concurrently update Item Alpha and Item Beta
      const [patch1, patch2] = await Promise.all([
        request(app)
          .patch(`/api/events/${event.id}/budget/items/${item1Id}`)
          .set(authHeaderA)
          .send({ isPaid: true, actualAmount: 950 }),
        request(app)
          .patch(`/api/events/${event.id}/budget/items/${item2Id}`)
          .set(authHeaderA)
          .send({ isPaid: false, actualAmount: 2100, notes: 'Upgraded Beta package' }),
      ]);

      expect(patch1.status).toBe(200);
      expect(patch2.status).toBe(200);

      // Verify both updates persisted cleanly
      const finalRes = await request(app)
        .get(`/api/events/${event.id}`)
        .set(authHeaderA);
      const items = finalRes.body.data.budget.items;
      const finalItem1 = items.find((i: any) => i.id === item1Id);
      const finalItem2 = items.find((i: any) => i.id === item2Id);

      expect(finalItem1.isPaid).toBe(true);
      expect(finalItem1.actualAmount).toBe(950);

      expect(finalItem2.isPaid).toBe(false);
      expect(finalItem2.actualAmount).toBe(2100);
      expect(finalItem2.notes).toBe('Upgraded Beta package');
    });

    it('preserves unrelated event fields and total budget during sub-resource mutations', async () => {
      const event = await createEventForUserA();
      const originalTitle = event.title;
      const originalTotalBudget = event.budget.totalBudget;
      const originalCurrency = event.budget.currency;
      const originalLocation = event.location;
      const originalOwnerId = event.ownerId;

      // Mutate sub-resource
      const res = await request(app)
        .post(`/api/events/${event.id}/budget/items`)
        .set(authHeaderA)
        .send({ category: 'Valet Parking', estimatedAmount: 1500 });
      expect(res.status).toBe(201);

      const updatedEvent = res.body.data;
      expect(updatedEvent.title).toBe(originalTitle);
      expect(updatedEvent.budget.totalBudget).toBe(originalTotalBudget);
      expect(updatedEvent.budget.currency).toBe(originalCurrency);
      expect(updatedEvent.location).toBe(originalLocation);
      expect(updatedEvent.ownerId).toBe(originalOwnerId);
    });
  });

  // ─── 6. Performance & Throughput Measurement ─────────────────────────────
  describe('Performance Benchmark Measurement', () => {
    it('executes 20 targeted sub-resource operations and measures latency', async () => {
      const event = await createEventForUserA();
      const operationsCount = 20;

      const startTime = performance.now();

      for (let i = 0; i < operationsCount; i++) {
        const res = await request(app)
          .post(`/api/events/${event.id}/budget/items`)
          .set(authHeaderA)
          .send({ category: `Benchmark Item ${i}`, estimatedAmount: 100 + i });
        expect(res.status).toBe(201);
      }

      const totalTimeMs = performance.now() - startTime;
      const avgMsPerOp = totalTimeMs / operationsCount;

      console.log(`[P2.3 Benchmark] 20 targeted budget additions completed in ${totalTimeMs.toFixed(2)}ms (avg ${avgMsPerOp.toFixed(2)}ms/op)`);
      expect(avgMsPerOp).toBeLessThan(100); // Expect sub-100ms per atomic operation locally
    });
  });
});
