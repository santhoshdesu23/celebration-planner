import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Event as EventType } from '@celebration-planner/shared';

const generateContent = vi.fn();
const getGenerativeModel = vi.fn(() => ({ generateContent }));
const GoogleGenerativeAI = vi.fn(() => ({ getGenerativeModel }));

vi.mock('@google/generative-ai', () => ({ GoogleGenerativeAI }));

const { aiService, aiCircuitBreaker } = await import('../src/services/aiService.js');
const { env } = await import('../src/config/env.js');

const event: EventType = {
  id: 'evt-ai-fallback',
  ownerId: 'u-ai-1',
  title: 'Fallback Gala',
  type: 'anniversary',
  eventDate: '2029-06-15T18:00:00.000Z',
  guestCount: 50,
  location: 'Test Hall',
  status: 'planning',
  budget: { currency: 'USD', totalBudget: 10000, items: [] },
  timeline: [],
  vendors: [],
  ideas: [],
  aiSuggestionsGenerated: false,
  aiPlanStatus: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const REAL_LOOKING_KEY = 'AIzaSyReal0000000000000000000000000000';
const mutableEnv = env as { GEMINI_API_KEY?: string };

/**
 * Characterization tests for when aiService calls Gemini versus uses the deterministic fallback.
 * The Gemini SDK is mocked, so no test here can reach the real API.
 */
describe('aiService fallback conditions', () => {
  const originalKey = mutableEnv.GEMINI_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    aiCircuitBreaker.resetForTest();
    mutableEnv.GEMINI_API_KEY = REAL_LOOKING_KEY;
    vi.stubEnv('NODE_ENV', 'production'); // simulate a live (non-test) runtime
    generateContent.mockResolvedValue({ response: { text: () => 'Plan advice text' } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    mutableEnv.GEMINI_API_KEY = originalKey;
    aiCircuitBreaker.resetForTest();
  });

  describe('uses the fallback without touching the SDK', () => {
    it('in test mode', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const plan = await aiService.generateEventPlan(event);
      const reply = await aiService.askAssistant(event, 'budget tips');
      expect(plan.ideas.length).toBeGreaterThan(0);
      expect(reply.response.length).toBeGreaterThan(0);
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it.each([
      ['missing key', undefined],
      ['"your_gemini" placeholder', 'your_gemini_api_key_here'],
      ['"placeholder" key', 'some-placeholder-key-value'],
    ])('with a %s', async (_label, key) => {
      mutableEnv.GEMINI_API_KEY = key;
      const plan = await aiService.generateEventPlan(event);
      const reply = await aiService.askAssistant(event, 'budget tips');
      expect(plan.ideas.length).toBeGreaterThan(0);
      expect(reply.response.length).toBeGreaterThan(0);
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    });

    it('while the circuit breaker is open', async () => {
      aiCircuitBreaker.recordFailure(new Error('404 Model Not Found'));
      expect(aiCircuitBreaker.isOpen()).toBe(true);
      const plan = await aiService.generateEventPlan(event);
      const reply = await aiService.askAssistant(event, 'budget tips');
      expect(plan.ideas.length).toBeGreaterThan(0);
      expect(reply.response.length).toBeGreaterThan(0);
      expect(GoogleGenerativeAI).not.toHaveBeenCalled();
    });
  });

  describe('calls Gemini when live, keyed and the breaker is closed', () => {
    it('askAssistant returns the model text using the configured model name', async () => {
      const reply = await aiService.askAssistant(event, 'budget tips');
      expect(GoogleGenerativeAI).toHaveBeenCalledWith(REAL_LOOKING_KEY);
      expect(getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3.1-flash-lite' })
      );
      expect(reply.response).toBe('Plan advice text');
    });

    it('generateEventPlan uses the same model name and falls back on malformed output', async () => {
      const plan = await aiService.generateEventPlan(event);
      expect(getGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'gemini-3.1-flash-lite' })
      );
      expect(generateContent).toHaveBeenCalledTimes(1);
      expect(plan.ideas.length).toBeGreaterThan(0); // 'Plan advice text' is not JSON -> fallback plan
    });

    it('askAssistant falls back and records a failure when Gemini throws', async () => {
      generateContent.mockRejectedValue(new Error('404 Model Not Found'));
      const reply = await aiService.askAssistant(event, 'budget tips');
      expect(reply.response.length).toBeGreaterThan(0);
      expect(reply.response).not.toBe('Plan advice text');
      expect(aiCircuitBreaker.isOpen()).toBe(true);
    });

    it('generateEventPlan falls back and records a failure when Gemini throws', async () => {
      generateContent.mockRejectedValue(new Error('404 Model Not Found'));
      const plan = await aiService.generateEventPlan(event);
      expect(plan.ideas.length).toBeGreaterThan(0);
      expect(aiCircuitBreaker.isOpen()).toBe(true);
    });
  });
});

