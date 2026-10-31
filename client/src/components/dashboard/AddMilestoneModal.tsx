import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

export interface AddMilestoneModalProps {
  isOpen: boolean;
  eventId: string;
  onClose: () => void;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function AddMilestoneModal({
  isOpen,
  eventId,
  onClose,
  onEventUpdated,
}: AddMilestoneModalProps) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    dueDate: '',
    category: 'General',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.dueDate) {
      toast.error('Please provide a title and due date');
      return;
    }
    try {
      setIsSubmitting(true);
      const updated = await api.addTimelineItem(eventId, {
        title: form.title,
        description: form.description || undefined,
        dueDate: new Date(form.dueDate).toISOString(),
        isCompleted: false,
        category: form.category || 'General',
      });
      onEventUpdated(updated);
      setForm({ title: '', description: '', dueDate: '', category: 'General' });
      onClose();
      toast.success('Milestone task added');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add milestone';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Timeline Milestone">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="add-milestone-title" className="block text-xs font-semibold text-charcoal mb-1">
            Task Title *
          </label>
          <input
            id="add-milestone-title"
            type="text"
            required
            value={form.title}
            onChange={(e) =>
              setForm({ ...form, title: e.target.value })
            }
            placeholder="e.g. Finalize seating chart & place cards"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div>
          <label htmlFor="add-milestone-date" className="block text-xs font-semibold text-charcoal mb-1">
            Target Due Date *
          </label>
          <input
            id="add-milestone-date"
            type="date"
            required
            value={form.dueDate}
            onChange={(e) =>
              setForm({ ...form, dueDate: e.target.value })
            }
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div>
          <label htmlFor="add-milestone-desc" className="block text-xs font-semibold text-charcoal mb-1">
            Description
          </label>
          <textarea
            id="add-milestone-desc"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
            placeholder="Details, assigned contact, or instructions"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={isSubmitting}>
            Add Milestone
          </Button>
        </div>
      </form>
    </Modal>
  );
}
