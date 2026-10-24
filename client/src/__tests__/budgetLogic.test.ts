import { describe, it, expect } from 'vitest';
import type { BudgetItem } from '@celebration-planner/shared';

describe('Client Budget & Export Calculations', () => {
  const sampleItems: BudgetItem[] = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      category: 'Venue & Hall',
      estimatedAmount: 10000,
      actualAmount: 9800,
      isPaid: true,
      notes: 'Paid deposit and balance',
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      category: 'Catering Service',
      estimatedAmount: 7000,
      actualAmount: 7200,
      isPaid: false,
      notes: 'Final invoice pending review',
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      category: 'Photography & Cinema',
      estimatedAmount: 3500,
      actualAmount: 0,
      isPaid: false,
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      category: 'Entertainment / Live Band',
      estimatedAmount: 2500,
      isPaid: true, // No actualAmount recorded, so estimatedAmount is considered paid
    },
  ];

  const totalBudget = 30000;

  it('correctly calculates total allocated (estimated) budget', () => {
    const estimatedTotal = sampleItems.reduce((sum, item) => sum + item.estimatedAmount, 0);
    expect(estimatedTotal).toBe(23000);
  });

  it('correctly calculates actual incurred spending', () => {
    const actualSpent = sampleItems.reduce((sum, item) => sum + (item.actualAmount || 0), 0);
    expect(actualSpent).toBe(17000); // 9800 + 7200
  });

  it('strictly distinguishes paid expenses from unpaid or allocated items', () => {
    const paidExpensesTotal = sampleItems.reduce((sum, item) => {
      if (!item.isPaid) return sum;
      const amount =
        item.actualAmount !== undefined && item.actualAmount !== null && item.actualAmount > 0
          ? item.actualAmount
          : item.estimatedAmount;
      return sum + amount;
    }, 0);

    // Item 1 (paid actual 9800) + Item 4 (paid estimated 2500) = 12300
    expect(paidExpensesTotal).toBe(12300);

    const paidCount = sampleItems.filter((i) => i.isPaid).length;
    expect(paidCount).toBe(2);
  });

  it('correctly calculates remaining funds and unallocated buffer', () => {
    const actualSpent = sampleItems.reduce((sum, item) => sum + (item.actualAmount || 0), 0);
    const estimatedTotal = sampleItems.reduce((sum, item) => sum + item.estimatedAmount, 0);

    const remainingFunds = totalBudget - actualSpent;
    const remainingBuffer = totalBudget - estimatedTotal;

    expect(remainingFunds).toBe(13000); // 30000 - 17000
    expect(remainingBuffer).toBe(7000); // 30000 - 23000
  });

  it('sanitizes export filename against path traversal and dangerous characters', () => {
    const dirtyTitle = 'Wedding: Alex & Sam / 2027? <Best Day>* | "Special"';
    const sanitized = dirtyTitle.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
    expect(sanitized).toBe('Wedding_Alex_Sam_2027_Best_Day_Special_');
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toContain(':');
    expect(sanitized).not.toContain('"');
  });
});
