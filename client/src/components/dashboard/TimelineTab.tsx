import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { CheckCircle, Circle, Calendar, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { AddMilestoneModal } from './AddMilestoneModal';
import type { Event as EventType, TimelineItem } from '@celebration-planner/shared';

export interface TimelineTabProps {
  event: EventType;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function TimelineTab({ event, onEventUpdated }: TimelineTabProps) {
  const [showAddMilestone, setShowAddMilestone] = useState(false);

  const completedMilestones = useMemo(
    () => (event.timeline || []).filter((m: TimelineItem) => m.isCompleted).length,
    [event.timeline]
  );

  const handleToggleMilestone = async (milestoneId: string, current: boolean) => {
    try {
      const updated = await api.updateTimelineItem(event.id, milestoneId, {
        isCompleted: !current,
      });
      onEventUpdated(updated);
      toast.success(
        !current ? '✨ Milestone completed!' : 'Milestone marked pending'
      );
    } catch (err: unknown) {
      toast.error('Could not update milestone');
    }
  };

  const handleDeleteMilestone = async (milestoneId: string) => {
    try {
      const updated = await api.deleteTimelineItem(event.id, milestoneId);
      onEventUpdated(updated);
      toast.success('Milestone removed');
    } catch (err: unknown) {
      toast.error('Could not delete milestone');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-charcoal">
            Celebration Timeline & Milestones
          </h2>
          <p className="text-sm text-muted">
            Chronological checklist synchronized relative to {formatDate(event.eventDate)}.
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setShowAddMilestone(true)}
          leftIcon={<Plus size={14} />}
        >
          Add Milestone
        </Button>
      </div>

      {/* Progress summary card */}
      <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold/15 flex items-center justify-center text-gold">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold text-charcoal">
              {completedMilestones} of {event.timeline.length} Milestones Completed
            </p>
            <p className="text-xs text-muted">
              {Math.round((completedMilestones / Math.max(1, event.timeline.length)) * 100)}% progress toward celebration day
            </p>
          </div>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round((completedMilestones / Math.max(1, event.timeline.length)) * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Milestones completion progress"
          className="w-36 h-2.5 bg-ivory-200 rounded-full overflow-hidden"
        >
          <div
            style={{
              width: `${Math.round(
                (completedMilestones / Math.max(1, event.timeline.length)) * 100
              )}%`,
            }}
            className="h-full bg-gold transition-all duration-500"
          />
        </div>
      </div>

      {/* Timeline Task Items */}
      <div className="space-y-3">
        {event.timeline.map((item: TimelineItem) => {
          const isPastDue =
            !item.isCompleted && new Date(item.dueDate).getTime() < Date.now();

          return (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-5 transition-all flex items-start gap-4 shadow-2xs ${
                item.isCompleted
                  ? 'border-ivory-200 bg-ivory-50/50 opacity-75'
                  : isPastDue
                  ? 'border-amber-200 hover:border-amber-400'
                  : 'border-ivory-200 hover:border-gold/50'
              }`}
            >
              <button
                type="button"
                onClick={() => handleToggleMilestone(item.id, item.isCompleted)}
                className="mt-0.5 text-muted hover:text-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                aria-label={item.isCompleted ? `Mark milestone pending: ${item.title}` : `Mark milestone completed: ${item.title}`}
                aria-pressed={item.isCompleted}
                title={item.isCompleted ? 'Mark pending' : 'Mark completed'}
              >
                {item.isCompleted ? (
                  <CheckCircle size={22} className="text-gold fill-gold/10" />
                ) : (
                  <Circle size={22} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4
                    className={`text-base font-semibold ${
                      item.isCompleted
                        ? 'line-through text-muted'
                        : 'text-charcoal'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <div className="flex items-center gap-2">
                    {isPastDue && (
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        Action Needed
                      </span>
                    )}
                    {item.category && (
                      <span className="text-xs bg-ivory-100 text-muted px-2.5 py-0.5 rounded-full font-medium">
                        {item.category}
                      </span>
                    )}
                    <span className="text-xs font-medium text-plum flex items-center gap-1 bg-plum-50 px-2.5 py-0.5 rounded-full">
                      <Calendar size={12} />
                      Target: {formatDate(item.dueDate)}
                    </span>
                  </div>
                </div>
              {item.description && (
                <p className="text-sm text-charcoal-light mt-1">
                  {item.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleDeleteMilestone(item.id)}
              className="text-muted hover:text-red-600 p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              aria-label={`Delete milestone: ${item.title}`}
              title="Delete milestone"
            >
              <Trash2 size={16} />
            </button>
          </div>
          );
        })}
      </div>

      <AddMilestoneModal
        isOpen={showAddMilestone}
        eventId={event.id}
        onClose={() => setShowAddMilestone(false)}
        onEventUpdated={onEventUpdated}
      />
    </div>
  );
}
