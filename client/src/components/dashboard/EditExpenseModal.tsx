import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import type { BudgetItem, Event as EventType } from '@celebration-planner/shared';

export interface EditExpenseModalProps {
  isOpen: boolean;
  expense: BudgetItem | null;
  eventId: string;
  currency: string;
  onClose: () => void;
  onEventUpdated: (updatedEvent: EventType) => void;
}

export function EditExpenseModal({
  isOpen,
  expense,
  eventId,
  currency,
  onClose,
  onEventUpdated,
}: EditExpenseModalProps) {
  const [form, setForm] = useState<{
    category: string;
    estimatedAmount: string;
    actualAmount: string;
    notes: string;
    isPaid: boolean;
  }>({
    category: '',
    estimatedAmount: '',
    actualAmount: '',
    notes: '',
    isPaid: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (expense) {
      setForm({
        category: expense.category,
        estimatedAmount: String(expense.estimatedAmount),
        actualAmount: expense.actualAmount !== undefined ? String(expense.actualAmount) : '',
        notes: expense.notes || '',
        isPaid: expense.isPaid,
      });
    }
  }, [expense]);

  if (!isOpen || !expense) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const updated = await api.updateBudgetItem(eventId, expense.id, {
        category: form.category.trim(),
        estimatedAmount: Number(form.estimatedAmount),
        actualAmount:
          form.actualAmount.trim() !== ''
            ? Number(form.actualAmount)
            : undefined,
        notes: form.notes.trim() || undefined,
        isPaid: form.isPaid,
      });
      onEventUpdated(updated);
      onClose();
      toast.success('Expense item updated!');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update expense item';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-xl border border-ivory-200">
        <h3 className="font-display text-xl font-bold text-charcoal mb-4">
          Edit Expense Item
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Category *
            </label>
            <input
              type="text"
              required
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Estimated ({currency}) *
              </label>
              <input
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
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-charcoal mb-1">
                Actual Cost ({currency})
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.actualAmount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actualAmount: e.target.value,
                  })
                }
                placeholder="e.g. 1150"
                className="w-full rounded-xl border border-ivory-300 px-3 py-2 text-sm focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              id="editIsPaid"
              checked={form.isPaid}
              onChange={(e) =>
                setForm({ ...form, isPaid: e.target.checked })
              }
              className="w-4 h-4 rounded text-green-600 focus:ring-green-500 border-ivory-300"
            />
            <label htmlFor="editIsPaid" className="text-xs font-semibold text-charcoal cursor-pointer">
              Mark as fully paid / settled
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-charcoal mb-1">
              Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Invoices, due dates, quotes…"
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
              Update Expense
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
