import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { WizardStep } from '@/hooks/useEventWizard';

interface WizardProgressProps {
  currentStep: WizardStep;
  totalSteps: number;
  stepLabels: string[];
  onStepClick: (step: WizardStep) => void;
}

export function WizardProgress({
  currentStep,
  totalSteps,
  stepLabels,
  onStepClick,
}: WizardProgressProps) {
  return (
    <nav aria-label="Event planning progress" className="w-full">
      <ol className="flex items-center justify-between relative">
        {/* Progress line */}
        <div
          aria-hidden="true"
          className="absolute left-0 top-5 h-0.5 bg-ivory-200 w-full -z-10"
        />
        <div
          aria-hidden="true"
          className="absolute left-0 top-5 h-0.5 bg-gradient-plum transition-all duration-500 -z-10"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
        />

        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = (i + 1) as WizardStep;
          const isCompleted = stepNum < currentStep;
          const isCurrent = stepNum === currentStep;
          const label = stepLabels[i];

          return (
            <li key={stepNum} className="flex flex-col items-center gap-2">
              <button
                type="button"
                aria-label={`Step ${stepNum}: ${label}${isCurrent ? ' (current)' : isCompleted ? ' (completed)' : ''}`}
                aria-current={isCurrent ? 'step' : undefined}
                onClick={() => onStepClick(stepNum)}
                disabled={!isCompleted}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm',
                  'transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400',
                  isCompleted &&
                    'bg-plum text-white cursor-pointer hover:bg-plum-400',
                  isCurrent &&
                    'bg-gradient-plum text-white shadow-lg ring-4 ring-plum/20',
                  !isCompleted &&
                    !isCurrent &&
                    'bg-ivory-200 text-muted cursor-not-allowed border-2 border-ivory-300'
                )}
              >
                {isCompleted ? <Check size={16} /> : stepNum}
              </button>
              <span
                className={cn(
                  'text-xs font-medium hidden sm:block text-center max-w-[80px]',
                  isCurrent ? 'text-plum' : isCompleted ? 'text-charcoal-light' : 'text-muted'
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
