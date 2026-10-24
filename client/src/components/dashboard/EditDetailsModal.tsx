import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import type { Event as EventType, EventStatus } from '@celebration-planner/shared';

export interface EditDetailsModalProps {
  isOpen: boolean;
  event: EventType;
  onClose: () => void;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function EditDetailsModal({
  isOpen,
  event,
  onClose,
  onEventUpdated,
}: EditDetailsModalProps) {
  const [form, setForm] = useState<{
    title: string;
    eventDate: string;
    location: string;
    guestCount: number;
    totalBudget: number;
    status: EventStatus;
    description: string;
  }>({
    title: event.title,
    eventDate: event.eventDate ? event.eventDate.slice(0, 10) : '',
    location: event.location,
    guestCount: event.guestCount,
    totalBudget: event.budget.totalBudget,
    status: event.status,
    description: event.description || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setForm({
        title: event.title,
        eventDate: event.eventDate ? event.eventDate.slice(0, 10) : '',
        location: event.location,
        guestCount: event.guestCount,
        totalBudget: event.budget.totalBudget,
        status: event.status,
        description: event.description || '',
      });
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const updated = await api.updateEvent(event.id, {
        title: form.title.trim(),
        eventDate: new Date(form.eventDate).toISOString(),
        location: form.location.trim(),
        guestCount: Number(form.guestCount),
        budget: {
          ...event.budget,
          totalBudget: Number(form.totalBudget),
        },
        status: form.status,
        description: form.description.trim() || undefined,
      });
      onEventUpdated(updated);
      onClose();
      toast.success('Celebration details updated!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update celebration details';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-ivory-200 max-h-[90vh] overflow-y-auto">
        <h3 className="font-display text-xl font-bold text-charcoal mb-4">
          Edit Celebration Details
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Event Date *
              </label>
              <input
                type="date"
                required
                value={form.eventDate}
                onChange={(e) => setForm({ ...form, eventDate: e.target.value })}
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              />
              <p className="text-[10px] text-muted mt-1">
                Timeline milestones will automatically synchronize relative to this date.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({
                    ...form,
                    status: e.target.value as EventStatus,
                  })
                }
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              >
                <option value="draft">Draft</option>
                <option value="planning">Planning</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Location *
              </label>
              <input
                type="text"
                required
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Guest Count *
              </label>
              <input
                type="number"
                required
                min="1"
                max="100000"
                value={form.guestCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    guestCount: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Target Budget ({event.budget.currency}) *
            </label>
            <input
              type="number"
              required
              min="1"
              step="any"
              value={form.totalBudget}
              onChange={(e) =>
                setForm({
                  ...form,
                  totalBudget: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Vision / Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
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
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
