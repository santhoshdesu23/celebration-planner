import { CheckCircle, Sparkles, ArrowRight } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { formatCurrency, formatEventType, formatDate } from '@/lib/utils';
import type { WizardFormData } from '@/hooks/useEventWizard';

interface Step4Props {
  formData: WizardFormData;
  isSubmitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

export function Step4Confirm({
  formData,
  isSubmitting,
  onSubmit,
  onBack,
}: Step4Props) {
  const budget = Number(formData.totalBudget);

  const summaryRows = [
    { label: 'Event Name', value: formData.title },
    {
      label: 'Type',
      value: formData.type ? formatEventType(formData.type) : '—',
    },
    {
      label: 'Date',
      value: formData.eventDate
        ? formatDate(new Date(formData.eventDate).toISOString())
        : '—',
    },
    { label: 'Location', value: formData.location },
    { label: 'Guests', value: `${formData.guestCount} people` },
    {
      label: 'Total Budget',
      value: budget > 0 ? formatCurrency(budget, formData.currency) : '—',
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-1">
          Ready to Create Your Event?
        </h2>
        <p className="text-muted text-sm">
          Review your details below and click Create to save your event plan.
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-gradient-ivory rounded-2xl border border-ivory-200 p-5 space-y-3">
        {summaryRows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 text-sm"
          >
            <span className="text-muted shrink-0 w-28">{row.label}</span>
            <span className="font-medium text-charcoal text-right">
              {row.value || '—'}
            </span>
          </div>
        ))}
        {formData.description && (
          <div className="pt-2 border-t border-ivory-200">
            <p className="text-xs text-muted mb-1">Vision</p>
            <p className="text-sm text-charcoal italic">
              &ldquo;{formData.description}&rdquo;
            </p>
          </div>
        )}
      </div>

      {/* What happens next */}
      <div className="bg-plum-50 rounded-2xl border border-plum-100 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles size={16} className="text-plum" />
          <p className="text-sm font-semibold text-plum">
            What happens next
          </p>
          <Badge variant="plum" size="sm">
            AI Powered
          </Badge>
        </div>
        <ul className="space-y-2">
          {[
            'Your celebration is saved securely',
            'AI generates tailored theme, decor, and entertainment ideas',
            'A milestone timeline is generated based on your event date',
            'Smart budget allocations & vendor checklists are created',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2 text-sm text-charcoal-light">
              <CheckCircle
                size={14}
                className="text-plum-300 mt-0.5 shrink-0"
              />
              {item}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted mt-3">
          ✦ You will be redirected directly to your interactive Celebration Dashboard.
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="lg" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button
          id="wizard-submit"
          variant="gold"
          size="lg"
          loading={isSubmitting}
          onClick={onSubmit}
          rightIcon={<ArrowRight size={18} />}
          leftIcon={!isSubmitting ? <Sparkles size={16} /> : undefined}
          className="flex-2"
        >
          {isSubmitting ? 'Creating…' : 'Create My Event'}
        </Button>
      </div>
    </div>
  );
}
