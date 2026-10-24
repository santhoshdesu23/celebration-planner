import { useState, useCallback } from 'react';
import type { EventType, BudgetCurrency } from '@celebration-planner/shared';

export interface WizardFormData {
  // Step 1 — basics
  title: string;
  type: EventType | '';
  eventDate: string;
  location: string;
  guestCount: string;
  description: string;
  // Step 2 — budget
  currency: BudgetCurrency;
  totalBudget: string;
  // Step 3 — categories
  budgetCategories: { category: string; percentage: number }[];
}

export type WizardStep = 1 | 2 | 3 | 4;

const TOTAL_STEPS = 4;

const DEFAULT_BUDGET_CATEGORIES = [
  { category: 'Venue', percentage: 30 },
  { category: 'Catering', percentage: 25 },
  { category: 'Photography', percentage: 15 },
  { category: 'Décor & Flowers', percentage: 12 },
  { category: 'Entertainment', percentage: 8 },
  { category: 'Miscellaneous', percentage: 10 },
];

const initialFormData: WizardFormData = {
  title: '',
  type: '',
  eventDate: '',
  location: '',
  guestCount: '',
  description: '',
  currency: 'USD',
  totalBudget: '',
  budgetCategories: DEFAULT_BUDGET_CATEGORIES,
};

export function useEventWizard() {
  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<WizardFormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<Record<keyof WizardFormData, string>>>({});

  const updateField = useCallback(
    <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      // Clear error on change
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const validateStep = useCallback(
    (s: WizardStep): boolean => {
      const newErrors: typeof errors = {};

      if (s === 1) {
        if (!formData.title.trim()) newErrors.title = 'Event title is required';
        if (!formData.type) newErrors.type = 'Please select an event type';
        if (!formData.eventDate) {
          newErrors.eventDate = 'Event date is required';
        } else if (new Date(formData.eventDate) < new Date()) {
          newErrors.eventDate = 'Event date must be in the future';
        }
        if (!formData.location.trim()) newErrors.location = 'Location is required';
        if (!formData.guestCount || Number(formData.guestCount) < 1) {
          newErrors.guestCount = 'Guest count must be at least 1';
        }
      }

      if (s === 2) {
        if (!formData.totalBudget || Number(formData.totalBudget) < 1) {
          newErrors.totalBudget = 'Please enter a budget greater than 0';
        }
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    },
    [formData]
  );

  const nextStep = useCallback(() => {
    if (validateStep(step) && step < TOTAL_STEPS) {
      setStep((s) => (s + 1) as WizardStep);
    }
  }, [step, validateStep]);

  const prevStep = useCallback(() => {
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  }, [step]);

  const goToStep = useCallback(
    (s: WizardStep) => {
      // Only allow jumping to already-validated steps
      if (s < step) setStep(s);
    },
    [step]
  );

  const reset = useCallback(() => {
    setStep(1);
    setFormData(initialFormData);
    setErrors({});
  }, []);

  const totalBudgetAmount = Number(formData.totalBudget) || 0;

  return {
    step,
    totalSteps: TOTAL_STEPS,
    formData,
    errors,
    totalBudgetAmount,
    updateField,
    nextStep,
    prevStep,
    goToStep,
    reset,
  };
}
