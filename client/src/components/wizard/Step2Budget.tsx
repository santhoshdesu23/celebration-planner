import { DollarSign, TrendingUp } from 'lucide-react';
import { Input, Select, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { WizardFormData } from '@/hooks/useEventWizard';
import type { BudgetCurrency } from '@celebration-planner/shared';

interface Step2Props {
  formData: WizardFormData;
  errors: Partial<Record<keyof WizardFormData, string>>;
  updateField: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void;
  totalBudgetAmount: number;
}

const currencyOptions: { value: BudgetCurrency; label: string }[] = [
  { value: 'USD', label: '🇺🇸 USD — US Dollar' },
  { value: 'EUR', label: '🇪🇺 EUR — Euro' },
  { value: 'GBP', label: '🇬🇧 GBP — British Pound' },
  { value: 'INR', label: '🇮🇳 INR — Indian Rupee' },
  { value: 'AUD', label: '🇦🇺 AUD — Australian Dollar' },
];

const budgetRanges = [
  { label: 'Micro', range: '< 2,000', value: 1500 },
  { label: 'Modest', range: '2k – 10k', value: 6000 },
  { label: 'Mid-range', range: '10k – 30k', value: 20000 },
  { label: 'Luxury', range: '30k – 100k', value: 50000 },
  { label: 'Premium', range: '100k+', value: 150000 },
];

export function Step2Budget({ formData, errors, updateField, totalBudgetAmount }: Step2Props) {
  const categories = formData.budgetCategories;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-1">
          Set Your Budget
        </h2>
        <p className="text-muted text-sm">
          We&apos;ll help you allocate funds across categories and track every
          expense.
        </p>
      </div>

      {/* Quick-select ranges */}
      <div>
        <p className="text-sm font-medium text-charcoal-light mb-3">
          Quick-select a range
        </p>
        <div className="flex flex-wrap gap-2">
          {budgetRanges.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => updateField('totalBudget', String(r.value))}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all duration-200
                ${
                  Number(formData.totalBudget) === r.value
                    ? 'bg-plum text-white border-plum'
                    : 'bg-white text-charcoal border-ivory-300 hover:border-plum-200 hover:bg-plum-50'
                }`}
              aria-pressed={Number(formData.totalBudget) === r.value}
            >
              {r.label}{' '}
              <span className="opacity-70 font-normal">{r.range}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Select
          id="currency"
          label="Currency"
          options={currencyOptions}
          value={formData.currency}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            updateField('currency', e.target.value as BudgetCurrency)
          }
        />
        <Input
          id="total-budget"
          label="Total Budget"
          type="number"
          min={1}
          placeholder="e.g. 25000"
          value={formData.totalBudget}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('totalBudget', e.target.value)}
          error={errors.totalBudget}
          required
          leftIcon={<DollarSign size={16} />}
          wrapperClassName="sm:col-span-2"
        />
      </div>

      {/* Budget breakdown preview */}
      {totalBudgetAmount > 0 && (
        <div className="bg-ivory-100 rounded-2xl p-5 border border-ivory-200">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-plum" />
            <p className="text-sm font-semibold text-charcoal">
              Estimated allocation
            </p>
            <Badge variant="plum" size="sm">
              AI-suggested
            </Badge>
          </div>
          <div className="space-y-2.5">
            {categories.map((cat: { category: string; percentage: number }) => {
              const amount = Math.round(
                (totalBudgetAmount * cat.percentage) / 100
              );
              return (
                <div key={cat.category}>
                  <div className="flex justify-between text-xs text-charcoal-light mb-1">
                    <span>{cat.category}</span>
                    <span className="font-medium">
                      {formatCurrency(amount, formData.currency)}{' '}
                      <span className="text-muted">({cat.percentage}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-ivory-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-plum rounded-full transition-all duration-500"
                      style={{ width: `${cat.percentage}%` }}
                      role="progressbar"
                      aria-valuenow={cat.percentage}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${cat.category} allocation`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted mt-3 italic">
            ⚠️ These are AI-estimated percentages. You can customise them after
            creating your event.
          </p>
        </div>
      )}
    </div>
  );
}
