import { useEffect, type Dispatch, type SetStateAction } from 'react';
import { toast } from 'react-hot-toast';
import { api } from '@/lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

const INITIAL_DELAY_MS = 1500;
const DELAY_STEP_MS = 1000;
const MAX_DELAY_MS = 4500;

/**
 * Polls the AI plan status of an owned event while generation is `pending` or `processing`.
 *
 * - Starts only when `enabled`, an `eventId` exists and the status is pending/processing.
 * - Backs off linearly (1.5s, then 2.5s, 3.5s, capped at 4.5s) after a still-running or failed request.
 * - Stops on `completed` (reloads the event) or `failed` (marks the event failed).
 * - Re-runs when the event ID, status or `enabled` flag changes; the previous timer is cleared first,
 *   and nothing is applied after unmount or cleanup.
 */
export function useAiPlanPolling(
  eventId: string | undefined,
  aiPlanStatus: EventType['aiPlanStatus'] | undefined,
  enabled: boolean,
  setEvent: Dispatch<SetStateAction<EventType | null>>
): void {
  useEffect(() => {
    if (!enabled || !eventId) return;
    if (aiPlanStatus !== 'pending' && aiPlanStatus !== 'processing') return;

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let delay = INITIAL_DELAY_MS;

    const poll = async () => {
      try {
        const statusRes = await api.getAiStatus(eventId);
        if (!isMounted) return;

        if (statusRes.aiPlanStatus === 'completed') {
          const updatedEvent = await api.getEvent(eventId);
          if (isMounted) {
            setEvent(updatedEvent);
            toast.success('🎉 Bespoke celebration plan ready with ideas and timeline!');
          }
          return;
        } else if (statusRes.aiPlanStatus === 'failed') {
          if (isMounted) {
            setEvent((prev) =>
              prev
                ? {
                    ...prev,
                    aiPlanStatus: 'failed',
                    aiPlanError: statusRes.aiPlanError || 'AI plan generation failed',
                  }
                : null
            );
            toast.error('AI plan generation encountered an issue. You can retry anytime.');
          }
          return;
        }
      } catch {
        // Non-fatal polling error; back off and retry
      }

      if (isMounted) {
        // Adaptive linear backoff: 1.5s -> 2.5s -> 3.5s -> max 4.5s
        delay = Math.min(delay + DELAY_STEP_MS, MAX_DELAY_MS);
        timeoutId = setTimeout(poll, delay);
      }
    };

    timeoutId = setTimeout(poll, delay);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [eventId, aiPlanStatus, enabled, setEvent]);
}

