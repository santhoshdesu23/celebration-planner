import type { Event as EventType } from '@celebration-planner/shared';
import { eventStore } from './eventStore.js';
import { aiService } from './aiService.js';
import { formatSafeError } from '../config/env.js';

class AiJobRunner {
  private activeJobs = new Set<string>();
  private sweepInterval: NodeJS.Timeout | null = null;

  /**
   * Dispatches an asynchronous AI plan generation job for an event.
   * Prevents duplicate runs by acquiring the atomic claim lock.
   */
  async triggerJob(eventId: string, ownerId: string): Promise<EventType | null> {
    const jobKey = `${ownerId}:${eventId}`;
    if (this.activeJobs.has(jobKey)) {
      return null;
    }

    // Atomically claim the job lock in DB / memory
    const claimed = await eventStore.claimAiPlanGeneration(eventId, ownerId);
    if (!claimed) {
      return null;
    }

    this.activeJobs.add(jobKey);

    const execute = async (): Promise<EventType | null> => {
      try {
        const event = await eventStore.findById(eventId, ownerId);
        if (!event) {
          await eventStore.failAiPlan(eventId, ownerId, 'Event not found when starting generation');
          return null;
        }

        // Call the AI service (which includes Gemini call + deterministic fallback)
        const plan = await aiService.generateEventPlan(event);

        // Atomically complete the plan and persist sub-resources
        const completed = await eventStore.completeAiPlan(eventId, ownerId, {
          ideas: plan.ideas,
          timeline: plan.timeline,
          vendors: plan.vendors,
          budgetItems: plan.budgetItems,
        });

        return completed;
      } catch (err: unknown) {
        const errorMsg = formatSafeError(err);
        console.warn(`[AiJobRunner] Generation failed for event ${eventId}: ${errorMsg}`);
        await eventStore.failAiPlan(eventId, ownerId, errorMsg);
        return null;
      } finally {
        this.activeJobs.delete(jobKey);
      }
    };

    return execute();
  }

  /**
   * Scans for pending or interrupted jobs across server restarts and triggers recovery.
   */
  async recoverPendingJobs(staleThresholdMs = 120_000): Promise<number> {
    try {
      const pending = await eventStore.findPendingOrStaleAiPlans(staleThresholdMs, 10);
      let recovered = 0;
      for (const event of pending) {
        // Trigger recovery in the background without blocking the sweep
        void this.triggerJob(event.id, event.ownerId);
        recovered++;
      }
      return recovered;
    } catch (err) {
      console.warn(`[AiJobRunner] Recovery sweep error: ${formatSafeError(err)}`);
      return 0;
    }
  }

  /**
   * Starts periodic background recovery sweep for resilient operation across restarts.
   */
  startBackgroundSweeper(intervalMs = 60_000): void {
    if (this.sweepInterval) return;
    // Initial recovery on boot
    void this.recoverPendingJobs();
    this.sweepInterval = setInterval(() => {
      void this.recoverPendingJobs();
    }, intervalMs);
    // Don't prevent Node process from exiting
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  stopBackgroundSweeper(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  isJobActive(eventId: string, ownerId: string): boolean {
    return this.activeJobs.has(`${ownerId}:${eventId}`);
  }

  /**
   * Helper for tests or polling: awaits completion of a background job.
   */
  async waitForJob(eventId: string, ownerId: string, timeoutMs = 4000): Promise<EventType | null> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const status = await eventStore.findAiStatus(eventId, ownerId);
      if (status && (status.aiPlanStatus === 'completed' || status.aiPlanStatus === 'failed')) {
        return eventStore.findById(eventId, ownerId);
      }
      await new Promise((r) => setTimeout(r, 25));
    }
    return eventStore.findById(eventId, ownerId);
  }
}

export const aiJobRunner = new AiJobRunner();
