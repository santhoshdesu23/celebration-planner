import { useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, Check, Edit2, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { AddExpenseModal } from './AddExpenseModal';
import type { Event as EventType, BudgetItem } from '@celebration-planner/shared';

export interface BudgetTabProps {
  event: EventType;
  onEventUpdated: (updatedEvent: EventType) => void;
  onOpenEditExpense: (item: BudgetItem) => void;
}

export function BudgetTab({
  event,
  onEventUpdated,
  onOpenEditExpense,
}: BudgetTabProps) {
  const [showAddExpense, setShowAddExpense] = useState(false);

  const totalBudget = event.budget.totalBudget;
  const currency = event.budget.currency;

  const {
    estimatedTotal,
    actualSpent,
    paidExpensesTotal,
    remainingFunds,
    remainingBuffer,
    paidItemsCount,
  } = useMemo(() => {
    const items = event.budget.items || [];
    let est = 0;
    let spent = 0;
    let paid = 0;
    let paidCount = 0;

    for (const item of items) {
      est += item.estimatedAmount;
      spent += item.actualAmount || 0;
      if (item.isPaid) {
        paidCount++;
        const amount =
          item.actualAmount !== undefined && item.actualAmount !== null && item.actualAmount > 0
            ? item.actualAmount
            : item.estimatedAmount;
        paid += amount;
      }
    }

    return {
      estimatedTotal: est,
      actualSpent: spent,
      paidExpensesTotal: paid,
      remainingFunds: totalBudget - spent,
      remainingBuffer: totalBudget - est,
      paidItemsCount: paidCount,
    };
  }, [event.budget, totalBudget]);

  const handleTogglePaidExpense = async (itemId: string, current: boolean) => {
    try {
      const updated = await api.updateBudgetItem(event.id, itemId, {
        isPaid: !current,
      });
      onEventUpdated(updated);
      toast.success(!current ? 'Expense marked as paid' : 'Expense marked unpaid');
    } catch (err: unknown) {
      toast.error('Could not update expense');
    }
  };

  const handleDeleteExpense = async (itemId: string) => {
    try {
      const updated = await api.deleteBudgetItem(event.id, itemId);
      onEventUpdated(updated);
      toast.success('Expense removed');
    } catch (err: unknown) {
      toast.error('Could not delete expense');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Budget Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm">
          <p className="text-xs text-muted font-medium mb-1">Target Budget</p>
          <p className="font-display text-2xl font-bold text-charcoal">
            {formatCurrency(totalBudget, currency)}
          </p>
          <p className="text-xs text-muted mt-2">Planned ceiling</p>
        </div>

        <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm">
          <p className="text-xs text-muted font-medium mb-1">Allocated (Estimated)</p>
          <p className="font-display text-2xl font-bold text-plum">
            {formatCurrency(estimatedTotal, currency)}
          </p>
          <p className="text-xs text-muted mt-2">
            {Math.round((estimatedTotal / totalBudget) * 100)}% of target allocated
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm">
          <p className="text-xs text-muted font-medium mb-1">Settled / Paid</p>
          <p className="font-display text-2xl font-bold text-green-700">
            {formatCurrency(paidExpensesTotal, currency)}
          </p>
          <p className="text-xs text-muted mt-2">
            {paidItemsCount} of {event.budget.items.length} items marked paid
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-ivory-200 p-5 shadow-sm">
          <p className="text-xs text-muted font-medium mb-1">Remaining Funds</p>
          <p
            className={`font-display text-2xl font-bold ${
              remainingFunds >= 0 ? 'text-charcoal' : 'text-red-600'
            }`}
          >
            {formatCurrency(remainingFunds, currency)}
          </p>
          <p className="text-xs text-muted mt-2">
            {remainingFunds >= 0 ? 'Surplus buffer available' : 'Budget deficit'}
          </p>
        </div>
      </div>

      {/* Visual Budget Health Bar */}
      <div className="bg-white rounded-3xl border border-ivory-200 p-6 shadow-sm space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="font-semibold text-charcoal">Budget Allocation Breakdown</span>
          <span className="text-xs text-muted">
            Unallocated Buffer: {formatCurrency(Math.max(0, remainingBuffer), currency)}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={Math.round(Math.min(100, (estimatedTotal / Math.max(1, totalBudget)) * 100))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Budget allocation progress"
          className="h-4 bg-ivory-200 rounded-full overflow-hidden flex"
        >
          <div
            style={{ width: `${Math.min(100, (estimatedTotal / Math.max(1, totalBudget)) * 100)}%` }}
            className={`h-full transition-all duration-500 ${
              estimatedTotal > totalBudget
                ? 'bg-red-500'
                : 'bg-gradient-to-r from-plum to-gold'
            }`}
          />
        </div>
      </div>

      {/* Budget Warnings & Decision Support */}
      {estimatedTotal > totalBudget && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm">
          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Budget Allocation Alert:</span> Planned itemized expenses exceed your target ceiling by{' '}
            <strong>{formatCurrency(estimatedTotal - totalBudget, currency)}</strong>. Consider trimming lower-priority items or adjusting your target ceiling to avoid overruns.
          </div>
        </div>
      )}

      {actualSpent > totalBudget && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 text-sm">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Actual Spending Deficit:</span> Realized expenses exceed your target budget by{' '}
            <strong>{formatCurrency(actualSpent - totalBudget, currency)}</strong>. Re-allocate remaining funds or pause non-critical vendor commitments.
          </div>
        </div>
      )}

      {/* Itemized Table */}
      <div className="bg-white rounded-3xl border border-ivory-200 overflow-hidden shadow-sm">
        <div className="p-5 flex items-center justify-between border-b border-ivory-200">
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal">
              Itemized Expenses
            </h3>
            <p className="text-xs text-muted">
              Track allocations, actual spent costs, and payment status.
            </p>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowAddExpense(true)}
            leftIcon={<Plus size={14} />}
          >
            Add Expense
          </Button>
        </div>

        {event.budget.items.length === 0 ? (
          <div className="p-12 text-center text-muted text-sm">
            No expense items yet. Click &ldquo;Add Expense&rdquo; to start tracking.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table aria-label="Itemized expenses" className="w-full text-left text-sm">
              <thead className="bg-ivory-100/60 text-xs text-muted uppercase tracking-wider border-b border-ivory-200">
                <tr>
                  <th scope="col" className="py-3 px-5">Paid</th>
                  <th scope="col" className="py-3 px-5">Category & Details</th>
                  <th scope="col" className="py-3 px-5 text-right">Estimated</th>
                  <th scope="col" className="py-3 px-5 text-right">Actual Cost</th>
                  <th scope="col" className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ivory-200">
                {event.budget.items.map((item: BudgetItem) => (
                  <tr key={item.id} className="hover:bg-ivory-50/50 transition-colors">
                    <td className="py-4 px-5">
                      <button
                        type="button"
                        onClick={() => handleTogglePaidExpense(item.id, item.isPaid)}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          item.isPaid
                            ? 'bg-green-600 text-white'
                            : 'border-2 border-ivory-300 text-transparent hover:border-plum'
                        }`}
                        aria-label={item.isPaid ? `Mark ${item.category} unpaid` : `Mark ${item.category} paid`}
                        aria-pressed={item.isPaid}
                        title={item.isPaid ? 'Mark as unpaid' : 'Mark as paid'}
                      >
                        <Check size={14} strokeWidth={3} />
                      </button>
                    </td>
                    <td className="py-4 px-5">
                      <p className="font-medium text-charcoal">{item.category}</p>
                      {item.notes && (
                        <p className="text-xs text-muted mt-0.5">{item.notes}</p>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right font-medium text-charcoal">
                      {formatCurrency(item.estimatedAmount, currency)}
                    </td>
                    <td className="py-4 px-5 text-right font-medium">
                      {item.actualAmount && item.actualAmount > 0 ? (
                        <span
                          className={
                            item.actualAmount > item.estimatedAmount
                              ? 'text-red-600 font-bold'
                              : 'text-green-700'
                          }
                        >
                          {formatCurrency(item.actualAmount, currency)}
                        </span>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onOpenEditExpense(item)}
                        className="text-muted hover:text-plum p-1 rounded-lg transition-colors mr-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                        title="Edit expense"
                        aria-label={`Edit expense: ${item.category}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteExpense(item.id)}
                        className="text-muted hover:text-red-600 p-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
                        title="Delete item"
                        aria-label={`Delete expense: ${item.category}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddExpenseModal
        isOpen={showAddExpense}
        eventId={event.id}
        currency={currency}
        onClose={() => setShowAddExpense(false)}
        onEventUpdated={onEventUpdated}
      />
    </div>
  );
}
