import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Button, Modal } from '@/components/ui';
import { api } from '@/lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

export interface AddExpenseModalProps {
  isOpen: boolean;
  eventId: string;
  currency: string;
  onClose: () => void;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function AddExpenseModal({
  isOpen,
  eventId,
  currency,
  onClose,
  onEventUpdated,
}: AddExpenseModalProps) {
  const [form, setForm] = useState({
    category: '',
    estimatedAmount: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.category || !form.estimatedAmount) {
      toast.error('Please enter a category and estimated amount');
      return;
    }
    try {
      setIsSubmitting(true);
      const updated = await api.addBudgetItem(eventId, {
        category: form.category,
        estimatedAmount: Number(form.estimatedAmount),
        actualAmount: 0,
        notes: form.notes || undefined,
        isPaid: false,
      });
      onEventUpdated(updated);
      setForm({ category: '', estimatedAmount: '', notes: '' });
      onClose();
      toast.success('Budget item added');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add budget item';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Budget Expense">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="add-expense-category" className="block text-xs font-semibold text-charcoal mb-1">
            Category or Item Name *
          </label>
          <input
            id="add-expense-category"
            type="text"
            required
            value={form.category}
            onChange={(e) =>
              setForm({ ...form, category: e.target.value })
            }
            placeholder="e.g. Wedding Cake, Acoustic Guitarist"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div>
          <label htmlFor="add-expense-amount" className="block text-xs font-semibold text-charcoal mb-1">
            Estimated Amount ({currency}) *
          </label>
          <input
            id="add-expense-amount"
            type="number"
            required
            min="0"
            step="any"
            value={form.estimatedAmount}
            onChange={(e) =>
              setForm({
                ...form,
                estimatedAmount: e.target.value,
              })
            }
            placeholder="e.g. 1200"
            className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
          />
        </div>

        <div>
          <label htmlFor="add-expense-notes" className="block text-xs font-semibold text-charcoal mb-1">
            Notes (Optional)
          </label>
          <textarea
            id="add-expense-notes"
            rows={2}
            value={form.notes}
            onChange={(e) =>
              setForm({ ...form, notes: e.target.value })
            }
            placeholder="Quotes, vendor options, payment deadline…"
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
            Save Item
          </Button>
        </div>
      </form>
    </Modal>
  );
}
