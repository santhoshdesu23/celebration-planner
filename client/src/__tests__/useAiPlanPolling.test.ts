import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { useAiPlanPolling } from '../hooks/useAiPlanPolling';
import { api } from '../lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

vi.mock('../lib/api', () => ({
  api: { getAiStatus: vi.fn(), getEvent: vi.fn() },
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const getAiStatus = api.getAiStatus as unknown as ReturnType<typeof vi.fn>;
const getEvent = api.getEvent as unknown as ReturnType<typeof vi.fn>;

type Status = EventType['aiPlanStatus'];

function setup(initial: { id?: string; status?: Status; enabled?: boolean }) {
  const setEvent = vi.fn();
  const hook = renderHook(
    (p: { id?: string; status?: Status; enabled?: boolean }) =>
      useAiPlanPolling(p.id, p.status, p.enabled ?? true, setEvent),
    { initialProps: initial }
  );
  return { setEvent, ...hook };
}

const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

describe('useAiPlanPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    getAiStatus.mockResolvedValue({ aiPlanStatus: 'pending' });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('start conditions', () => {
    it.each<[string, { id?: string; status?: Status; enabled?: boolean }]>([
      ['status is completed', { id: 'e1', status: 'completed' }],
      ['status is failed', { id: 'e1', status: 'failed' }],
      ['status is unknown', { id: 'e1', status: undefined }],
      ['there is no event id', { id: undefined, status: 'pending' }],
      ['polling is disabled (guest mode)', { id: 'e1', status: 'pending', enabled: false }],
    ])('does not poll when %s', async (_label, props) => {
      setup(props);
      await advance(20_000);
      expect(getAiStatus).not.toHaveBeenCalled();
    });

    it.each<Status>(['pending', 'processing'])('polls when status is %s', async (status) => {
      setup({ id: 'e1', status });
      await advance(1499);
      expect(getAiStatus).not.toHaveBeenCalled();
      await advance(1);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      expect(getAiStatus).toHaveBeenCalledWith('e1');
    });
  });

  describe('backoff', () => {
    it('waits 1.5s, then 2.5s, 3.5s, and caps at 4.5s while still pending', async () => {
      setup({ id: 'e1', status: 'pending' });
      await advance(1500);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      await advance(2499);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      await advance(1);
      expect(getAiStatus).toHaveBeenCalledTimes(2);
      await advance(3500);
      expect(getAiStatus).toHaveBeenCalledTimes(3);
      await advance(4500);
      expect(getAiStatus).toHaveBeenCalledTimes(4);
      await advance(4500);
      expect(getAiStatus).toHaveBeenCalledTimes(5);
    });

    it('keeps polling with backoff after a request error', async () => {
      getAiStatus.mockRejectedValueOnce(new Error('network'));
      setup({ id: 'e1', status: 'pending' });
      await advance(1500);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      await advance(2500);
      expect(getAiStatus).toHaveBeenCalledTimes(2);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('never has overlapping timers: one request per interval', async () => {
      const { rerender } = setup({ id: 'e1', status: 'pending' });
      rerender({ id: 'e1', status: 'pending' }); // identical props must not restart or duplicate
      await advance(1500);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
    });
  });

  describe('termination', () => {
    it('on completed: reloads the event, shows success, and stops polling', async () => {
      const fresh = { id: 'e1', title: 'Fresh' } as EventType;
      getAiStatus.mockResolvedValue({ aiPlanStatus: 'completed' });
      getEvent.mockResolvedValue(fresh);
      const { setEvent } = setup({ id: 'e1', status: 'pending' });

      await advance(1500);

      expect(getEvent).toHaveBeenCalledWith('e1');
      expect(setEvent).toHaveBeenCalledWith(fresh);
      expect(toast.success).toHaveBeenCalledTimes(1);

      await advance(30_000);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
    });

    it('on failed: marks the event failed with the server error, and stops polling', async () => {
      getAiStatus.mockResolvedValue({ aiPlanStatus: 'failed', aiPlanError: 'quota exceeded' });
      const { setEvent } = setup({ id: 'e1', status: 'processing' });

      await advance(1500);

      const updater = setEvent.mock.calls[0][0] as (prev: EventType | null) => EventType | null;
      expect(updater({ id: 'e1', aiPlanStatus: 'processing' } as EventType)).toMatchObject({
        aiPlanStatus: 'failed',
        aiPlanError: 'quota exceeded',
      });
      expect(updater(null)).toBeNull();
      expect(toast.error).toHaveBeenCalledTimes(1);

      await advance(30_000);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
    });

    it('uses a default message when a failed status has no error text', async () => {
      getAiStatus.mockResolvedValue({ aiPlanStatus: 'failed' });
      const { setEvent } = setup({ id: 'e1', status: 'pending' });
      await advance(1500);
      const updater = setEvent.mock.calls[0][0] as (prev: EventType | null) => EventType | null;
      expect(updater({ id: 'e1' } as EventType)?.aiPlanError).toBe('AI plan generation failed');
    });

    it('stops when the status prop changes to a terminal value', async () => {
      const { rerender } = setup({ id: 'e1', status: 'pending' });
      rerender({ id: 'e1', status: 'completed' });
      await advance(30_000);
      expect(getAiStatus).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('clears the pending timer on unmount', async () => {
      const { unmount } = setup({ id: 'e1', status: 'pending' });
      unmount();
      await advance(30_000);
      expect(getAiStatus).not.toHaveBeenCalled();
    });

    it('does not apply results from an in-flight request after unmount', async () => {
      let resolveStatus!: (v: unknown) => void;
      getAiStatus.mockImplementation(() => new Promise((r) => { resolveStatus = r; }));
      const { unmount, setEvent } = setup({ id: 'e1', status: 'pending' });

      await advance(1500);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      unmount();
      await act(async () => { resolveStatus({ aiPlanStatus: 'completed' }); });
      await advance(30_000);

      expect(getEvent).not.toHaveBeenCalled();
      expect(setEvent).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(getAiStatus).toHaveBeenCalledTimes(1);
    });

    it('switches to the new event id and stops polling the old one', async () => {
      const { rerender } = setup({ id: 'old', status: 'pending' });
      await advance(1000);
      rerender({ id: 'new', status: 'pending' });

      await advance(1499);
      expect(getAiStatus).not.toHaveBeenCalled(); // old timer was cleared, new one not yet due
      await advance(1);
      expect(getAiStatus).toHaveBeenCalledTimes(1);
      expect(getAiStatus).toHaveBeenCalledWith('new');
      expect(getAiStatus).not.toHaveBeenCalledWith('old');
    });
  });
});

