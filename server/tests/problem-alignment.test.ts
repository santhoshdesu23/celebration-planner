import { describe, it, expect, beforeEach } from 'vitest';
import { aiService, aiCircuitBreaker } from '../src/services/aiService.js';
import type { Event as EventType } from '@celebration-planner/shared';

describe('Problem Alignment - AI Event Planning Tailoring & Accuracy', () => {
  beforeEach(() => {
    aiCircuitBreaker.resetForTest();
  });

  it('generates corporate event plans with business-relevant ideas, AV vendors, and precise budget allocations', async () => {
    const corporateEvent = {
      title: 'Global Tech Summit 2027',
      type: 'corporate' as const,
      eventDate: '2027-11-12T09:00:00.000Z',
      guestCount: 250,
      location: 'San Francisco Convention Center',
      description: 'Annual corporate engineering summit with keynote speeches and breakout tracks',
      budget: {
        currency: 'USD',
        totalBudget: 80000,
        items: [],
      },
    };

    const plan = await aiService.generateEventPlan(corporateEvent);

    // Ideas tailoring
    expect(plan.ideas.length).toBeGreaterThanOrEqual(3);
    const ideaTitles = plan.ideas.map((i) => i.title).join(' ');
    expect(ideaTitles).toMatch(/Keynote Stage|Executive|Barista/i);

    // Budget tailoring & precision
    expect(plan.budgetItems.length).toBeGreaterThanOrEqual(4);
    const budgetCategories = plan.budgetItems.map((b) => b.category);
    expect(budgetCategories.some((c) => c.includes('Conference Hall'))).toBe(true);
    expect(budgetCategories.some((c) => c.includes('AV') && c.includes('Staging'))).toBe(true);

    const allocatedSum = plan.budgetItems.reduce((acc, b) => acc + b.estimatedAmount, 0);
    expect(allocatedSum).toBe(corporateEvent.budget.totalBudget);

    // Vendors tailoring
    expect(plan.vendors.length).toBeGreaterThanOrEqual(3);
    const vendorNames = plan.vendors.map((v) => v.name).join(' ');
    expect(vendorNames).toMatch(/Convention Center|AV|Media/i);
  });

  it('generates anniversary plans with intimate milestone retrospective, sommelier dining, and balanced budget', async () => {
    const anniversaryEvent = {
      title: 'Golden 50th Wedding Anniversary',
      type: 'anniversary' as const,
      eventDate: '2027-06-20T17:00:00.000Z',
      guestCount: 60,
      location: 'Napa Valley, CA',
      description: 'A celebration of 50 years of love with close friends and multi-generational family',
      budget: {
        currency: 'USD',
        totalBudget: 35000,
        items: [],
      },
    };

    const plan = await aiService.generateEventPlan(anniversaryEvent);

    // Ideas tailoring
    const ideaTitles = plan.ideas.map((i) => i.title).join(' ');
    expect(ideaTitles).toMatch(/Retrospective|Sommelier|Cinema/i);

    // Budget sum must equal total target
    const allocatedSum = plan.budgetItems.reduce((acc, b) => acc + b.estimatedAmount, 0);
    expect(allocatedSum).toBe(anniversaryEvent.budget.totalBudget);

    // Vendors tailoring
    const vendorNames = plan.vendors.map((v) => v.name).join(' ');
    expect(vendorNames).toMatch(/Estate|Sommelier|Milestone|Strings/i);
  });

  it('generates graduation plans with cap & gown memory wall, food trucks, and balanced budget', async () => {
    const graduationEvent = {
      title: 'Class of 2027 Commencement Gala',
      type: 'graduation' as const,
      eventDate: '2027-06-15T16:00:00.000Z',
      guestCount: 80,
      location: 'Boston, MA',
      description: 'Commencement celebration with classmates, family, and faculty',
      budget: {
        currency: 'USD',
        totalBudget: 12000,
        items: [],
      },
    };

    const plan = await aiService.generateEventPlan(graduationEvent);

    const ideaTitles = plan.ideas.map((i) => i.title).join(' ');
    expect(ideaTitles).toMatch(/Cap|Gown|Food Truck|Polaroid/i);

    const allocatedSum = plan.budgetItems.reduce((acc, b) => acc + b.estimatedAmount, 0);
    expect(allocatedSum).toBe(graduationEvent.budget.totalBudget);
  });

  it('generates baby shower plans with botanical cloud and high-tea keepsakes', async () => {
    const babyShowerEvent = {
      title: 'Welcome Baby Oliver',
      type: 'baby_shower' as const,
      eventDate: '2027-05-15T14:00:00.000Z',
      guestCount: 35,
      location: 'Austin, TX',
      description: 'Afternoon tea baby shower celebration',
      budget: {
        currency: 'USD',
        totalBudget: 3000,
        items: [],
      },
    };

    const plan = await aiService.generateEventPlan(babyShowerEvent);

    const ideaTitles = plan.ideas.map((i) => i.title).join(' ');
    expect(ideaTitles).toMatch(/Botanical Cloud|High Tea|Wishes for Baby/i);

    const allocatedSum = plan.budgetItems.reduce((acc, b) => acc + b.estimatedAmount, 0);
    expect(allocatedSum).toBe(babyShowerEvent.budget.totalBudget);
  });

  it('preserves user custom budget items without overriding or duplicating them', async () => {
    const customEvent = {
      title: 'Custom Curated Birthday',
      type: 'birthday' as const,
      eventDate: '2027-07-10T19:00:00.000Z',
      guestCount: 40,
      location: 'Chicago, IL',
      description: 'Bespoke rooftop birthday party',
      budget: {
        currency: 'USD',
        totalBudget: 15000,
        items: [
          {
            id: 'b-custom-1',
            category: 'Rooftop Lounge Rental',
            estimatedAmount: 8000,
            actualAmount: 7500,
            isPaid: true,
          },
        ],
      },
    };

    const plan = await aiService.generateEventPlan(customEvent);

    // When custom budget items are already provided by user, the generator respects user choices and preserves them
    expect(plan.budgetItems).toEqual(customEvent.budget.items);
    expect(plan.ideas.length).toBeGreaterThanOrEqual(3);
    expect(plan.timeline.length).toBeGreaterThanOrEqual(4);
    expect(plan.vendors.length).toBeGreaterThanOrEqual(3);
  });

  it('provides contextual assistant guidance with interactive suggestions', async () => {
    const mockFullEvent: EventType = {
      id: 'evt-test-1',
      ownerId: 'u-1',
      title: 'Centennial Tech Gala',
      type: 'corporate',
      eventDate: '2027-11-20T18:00:00.000Z',
      guestCount: 150,
      location: 'Seattle, WA',
      status: 'planning',
      budget: {
        currency: 'USD',
        totalBudget: 60000,
        items: [],
      },
      timeline: [],
      vendors: [],
      ideas: [],
      aiSuggestionsGenerated: true,
      createdAt: '2026-10-24T00:00:00.000Z',
      updatedAt: '2026-10-24T00:00:00.000Z',
    };

    // Ask budget optimization
    const budgetReply = await aiService.askAssistant(
      mockFullEvent,
      'How can we reduce our venue or catering costs by 15%?',
      'budget'
    );
    expect(budgetReply.response).toContain('Budget Optimization Tips for Centennial Tech Gala');
    expect(budgetReply.response).toContain('150'); // includes guest count
    expect(budgetReply.suggestions.length).toBeGreaterThan(0);

    // Ask vendor outreach email
    const vendorReply = await aiService.askAssistant(
      mockFullEvent,
      'Draft a friendly vendor inquiry email',
      'vendors'
    );
    expect(vendorReply.response).toContain('Sample Vendor Inquiry Template');
    expect(vendorReply.response).toContain('Centennial Tech Gala');
    expect(vendorReply.response).toContain('Seattle, WA');

    // Ask run of show
    const scheduleReply = await aiService.askAssistant(
      mockFullEvent,
      'Generate a run-of-show schedule for the reception',
      'timeline'
    );
    expect(scheduleReply.response).toContain('Suggested Run-of-Show for Centennial Tech Gala');
    expect(scheduleReply.suggestions.length).toBeGreaterThan(0);
  });
});
