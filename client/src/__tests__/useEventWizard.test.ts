import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventWizard } from '../hooks/useEventWizard';

describe('useEventWizard Hook', () => {
  it('initializes with default step 1, empty fields, and default budget categories', () => {
    const { result } = renderHook(() => useEventWizard());

    expect(result.current.step).toBe(1);
    expect(result.current.totalSteps).toBe(4);
    expect(result.current.formData.title).toBe('');
    expect(result.current.formData.currency).toBe('USD');
    expect(result.current.formData.budgetCategories.length).toBeGreaterThan(0);
    expect(result.current.errors).toEqual({});
  });

  it('updates a field and clears the error for that field', () => {
    const { result } = renderHook(() => useEventWizard());

    // Trigger validation failure on step 1 to populate errors
    act(() => {
      result.current.nextStep();
    });
    expect(result.current.errors.title).toBeDefined();

    // Update field
    act(() => {
      result.current.updateField('title', 'Maya & Liam Engagement');
    });

    expect(result.current.formData.title).toBe('Maya & Liam Engagement');
    expect(result.current.errors.title).toBeUndefined();
  });

  describe('Step 1 Validation', () => {
    it('fails if title, type, date, location, or guestCount are invalid', () => {
      const { result } = renderHook(() => useEventWizard());

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(1);
      expect(result.current.errors.title).toBe('Event title is required');
      expect(result.current.errors.type).toBe('Please select an event type');
      expect(result.current.errors.eventDate).toBe('Event date is required');
      expect(result.current.errors.location).toBe('Location is required');
      expect(result.current.errors.guestCount).toBe('Guest count must be at least 1');
    });

    it('rejects past dates', () => {
      const { result } = renderHook(() => useEventWizard());

      act(() => {
        result.current.updateField('title', 'Past Party');
        result.current.updateField('type', 'birthday');
        result.current.updateField('eventDate', '2020-01-01');
        result.current.updateField('location', 'Austin, TX');
        result.current.updateField('guestCount', '50');
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(1);
      expect(result.current.errors.eventDate).toBe('Event date must be in the future');
    });

    it('advances to step 2 when all step 1 fields are valid', () => {
      const { result } = renderHook(() => useEventWizard());
      const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      act(() => {
        result.current.updateField('title', 'Valid Gala');
        result.current.updateField('type', 'corporate');
        result.current.updateField('eventDate', futureDate);
        result.current.updateField('location', 'San Francisco, CA');
        result.current.updateField('guestCount', '150');
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(2);
      expect(result.current.errors).toEqual({});
    });
  });

  describe('Step 2 Validation & Budget Calculation', () => {
    it('fails if total budget is missing or zero', () => {
      const { result } = renderHook(() => useEventWizard());
      const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      act(() => {
        result.current.updateField('title', 'Valid Gala');
        result.current.updateField('type', 'corporate');
        result.current.updateField('eventDate', futureDate);
        result.current.updateField('location', 'San Francisco, CA');
        result.current.updateField('guestCount', '150');
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(2);

      // Attempt next step with empty budget
      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(2);
      expect(result.current.errors.totalBudget).toBe('Please enter a budget greater than 0');

      // Enter valid budget
      act(() => {
        result.current.updateField('totalBudget', '35000');
      });
      expect(result.current.totalBudgetAmount).toBe(35000);

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(3);
    });
  });

  describe('Navigation & Reset', () => {
    it('supports prevStep and goToStep for already-visited steps', () => {
      const { result } = renderHook(() => useEventWizard());
      const futureDate = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      act(() => {
        result.current.updateField('title', 'Valid Gala');
        result.current.updateField('type', 'corporate');
        result.current.updateField('eventDate', futureDate);
        result.current.updateField('location', 'San Francisco, CA');
        result.current.updateField('guestCount', '150');
      });

      act(() => {
        result.current.nextStep();
      });

      act(() => {
        result.current.updateField('totalBudget', '20000');
      });

      act(() => {
        result.current.nextStep();
      });

      expect(result.current.step).toBe(3);

      act(() => {
        result.current.prevStep();
      });
      expect(result.current.step).toBe(2);

      act(() => {
        result.current.goToStep(1);
      });
      expect(result.current.step).toBe(1);

      // Does not allow jumping ahead past validated step
      act(() => {
        result.current.goToStep(4);
      });
      expect(result.current.step).toBe(1);
    });

    it('resets form back to initial state', () => {
      const { result } = renderHook(() => useEventWizard());

      act(() => {
        result.current.updateField('title', 'Some Event');
        result.current.reset();
      });

      expect(result.current.step).toBe(1);
      expect(result.current.formData.title).toBe('');
      expect(result.current.errors).toEqual({});
    });
  });
});
