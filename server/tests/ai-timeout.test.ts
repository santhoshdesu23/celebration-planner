import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withTimeout } from '../src/services/aiService.js';

describe('withTimeout helper', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves with the promised value when the promise finishes before timeout and clears the timer', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const fastPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('success-payload'), 50);
    });

    const timeoutPromise = withTimeout(fastPromise, 500, 'Test Fast');

    await vi.advanceTimersByTimeAsync(50);
    const result = await timeoutPromise;

    expect(result).toBe('success-payload');
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advancing past the original timeout must not trigger any delayed rejection
    await vi.advanceTimersByTimeAsync(1000);
  });

  it('rejects with the underlying promise error and clears the timer without swallowing the error', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const failingPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('underlying network failure')), 50);
    });

    const timeoutPromise = withTimeout(failingPromise, 500, 'Test Failure');
    const assertion = expect(timeoutPromise).rejects.toThrow('underlying network failure');

    await vi.advanceTimersByTimeAsync(50);
    await assertion;

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('rejects with timeout error when promise exceeds timeoutMs', async () => {
    const neverEndingPromise = new Promise<string>(() => {
      // Intentionally never resolves
    });

    const timeoutPromise = withTimeout(neverEndingPromise, 300, 'Gemini LLM Call');
    const assertion = expect(timeoutPromise).rejects.toThrow('Timeout: Gemini LLM Call exceeded 300ms');

    // Advance right to the timeout boundary
    await vi.advanceTimersByTimeAsync(300);
    await assertion;
  });
});
