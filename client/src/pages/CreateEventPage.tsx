import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import { Step1EventBasics } from '@/components/wizard/Step1EventBasics';
import { Step2Budget } from '@/components/wizard/Step2Budget';
import { Step3Preview } from '@/components/wizard/Step3Preview';
import { Step4Confirm } from '@/components/wizard/Step4Confirm';
import { useEventWizard } from '@/hooks/useEventWizard';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/authContext';
import { setGuestDraft } from '@/lib/guestDraft';
import type { EventType, CreateEventInput } from '@celebration-planner/shared';
import type { WizardStep } from '@/hooks/useEventWizard';

const STEP_LABELS = ['Event Details', 'Budget', 'Preview', 'Confirm'];

export function CreateEventPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    step,
    totalSteps,
    formData,
    errors,
    totalBudgetAmount,
    updateField,
    nextStep,
    prevStep,
    goToStep,
    reset,
  } = useEventWizard();

  // Pre-fill event type from URL params (e.g. ?type=wedding from category cards)
  useEffect(() => {
    const typeParam = searchParams.get('type') as EventType | null;
    if (typeParam && !formData.type) {
      updateField('type', typeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const eventDateISO = new Date(formData.eventDate).toISOString();
      const payload: CreateEventInput = {
        title: formData.title.trim(),
        type: formData.type as EventType,
        eventDate: eventDateISO,
        guestCount: Number(formData.guestCount),
        location: formData.location.trim(),
        description: formData.description?.trim() || undefined,
        budget: {
          currency: formData.currency,
          totalBudget: Number(formData.totalBudget),
          items: formData.budgetCategories.map((c) => ({
            id: crypto.randomUUID(),
            category: c.category,
            estimatedAmount: Math.round(
              (Number(formData.totalBudget) * c.percentage) / 100
            ),
            actualAmount: 0,
            isPaid: false,
          })),
        },
      };

      if (isAuthenticated) {
        const created = await api.createEvent(payload);
        toast.success('🎉 Celebration created! Crafting your AI plan...');
        reset();
        navigate(`/events/${created.id}`);
      } else {
        // Guest mode: generate full preview without login requirement
        const guestPlan = await api.generateGuestPlan(payload);
        setGuestDraft(guestPlan);
        toast.success('✨ Bespoke celebration plan created! Explore and customize it below.');
        reset();
        navigate('/guest-plan');
      }
    } catch (err: any) {
      console.error('Failed to create event:', err);
      toast.error(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ivory py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-muted hover:text-plum transition-colors mb-8 group"
          aria-label="Back to home"
        >
          <ArrowLeft
            size={16}
            className="group-hover:-translate-x-1 transition-transform"
          />
          Back to home
        </button>

        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal mb-2">
            Create Your Event
          </h1>
          <p className="text-muted text-sm">
            Step {step} of {totalSteps} —{' '}
            <span className="text-charcoal-light font-medium">
              {STEP_LABELS[step - 1]}
            </span>
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <WizardProgress
            currentStep={step}
            totalSteps={totalSteps}
            stepLabels={STEP_LABELS}
            onStepClick={(s: WizardStep) => goToStep(s)}
          />
        </div>

        {/* Step content */}
        <Card variant="default" padding="lg" className="mb-6">
          {step === 1 && (
            <Step1EventBasics
              formData={formData}
              errors={errors}
              updateField={updateField}
            />
          )}
          {step === 2 && (
            <Step2Budget
              formData={formData}
              errors={errors}
              updateField={updateField}
              totalBudgetAmount={totalBudgetAmount}
            />
          )}
          {step === 3 && <Step3Preview formData={formData} />}
          {step === 4 && (
            <Step4Confirm
              formData={formData}
              isSubmitting={isSubmitting}
              onSubmit={handleSubmit}
              onBack={prevStep}
            />
          )}
        </Card>

        {/* Navigation buttons — not shown on step 4 (it has its own) */}
        {step < 4 && (
          <div className="flex gap-3">
            {step > 1 && (
              <Button
                variant="secondary"
                size="lg"
                onClick={prevStep}
                className="flex-1"
              >
                Back
              </Button>
            )}
            <Button
              id={`wizard-next-step-${step}`}
              variant="primary"
              size="lg"
              onClick={nextStep}
              className="flex-1"
            >
              {step === 3 ? 'Review & Confirm' : 'Continue'}
            </Button>
          </div>
        )}

        {/* Step indicator (mobile) */}
        <p className="text-center text-xs text-muted mt-4">
          {step} / {totalSteps} steps completed
        </p>
      </div>
    </div>
  );
}
