import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step4Confirm } from '../components/wizard/Step4Confirm';
import { Step3Preview } from '../components/wizard/Step3Preview';
import { Step2Budget } from '../components/wizard/Step2Budget';
import type { WizardFormData } from '../hooks/useEventWizard';

const baseFormData: WizardFormData = {
  title: 'Golden Jubilee Celebration',
  type: 'anniversary',
  eventDate: '2026-12-25',
  location: 'Grand Crystal Ballroom',
  guestCount: '150',
  description: 'An elegant golden-themed evening celebration with jazz music.',
  currency: 'USD',
  totalBudget: '5000',
  budgetCategories: [
    { category: 'Venue', percentage: 30 },
    { category: 'Catering', percentage: 25 },
    { category: 'Photography', percentage: 15 },
    { category: 'Décor & Flowers', percentage: 12 },
    { category: 'Entertainment', percentage: 8 },
    { category: 'Miscellaneous', percentage: 10 },
  ],
};

describe('Wizard Step Components', () => {
  describe('Step4Confirm', () => {
    it('renders event title, formatted event type, location, and guest count', () => {
      render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: /Ready to Create Your Event\?/i })).toBeInTheDocument();
      expect(screen.getByText('Golden Jubilee Celebration')).toBeInTheDocument();
      expect(screen.getByText('Anniversary')).toBeInTheDocument();
      expect(screen.getByText('Grand Crystal Ballroom')).toBeInTheDocument();
      expect(screen.getByText('150 people')).toBeInTheDocument();
    });

    it('formats budget with currency symbol for representative value ($5,000)', () => {
      render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText('$5,000')).toBeInTheDocument();
    });

    it('handles empty or zero budget with fallback dash', () => {
      const emptyBudgetForm: WizardFormData = {
        ...baseFormData,
        totalBudget: '',
      };

      render(
        <Step4Confirm
          formData={emptyBudgetForm}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      // Dash is displayed when budget is <= 0 or empty
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('formats event date into human-readable string and handles empty date with dash', () => {
      const { rerender } = render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText('December 25, 2026')).toBeInTheDocument();

      rerender(
        <Step4Confirm
          formData={{ ...baseFormData, eventDate: '' }}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.queryByText('December 25, 2026')).not.toBeInTheDocument();
      expect(screen.getAllByText('—').length).toBeGreaterThan(0);
    });

    it('renders vision description when provided, and omits vision section when empty', () => {
      const { rerender } = render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.getByText('Vision')).toBeInTheDocument();
      expect(
        screen.getByText(/An elegant golden-themed evening celebration with jazz music\./i)
      ).toBeInTheDocument();

      rerender(
        <Step4Confirm
          formData={{ ...baseFormData, description: '' }}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={vi.fn()}
        />
      );

      expect(screen.queryByText('Vision')).not.toBeInTheDocument();
    });

    it('calls onSubmit when the Create My Event button is clicked', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Create My Event/i });
      await user.click(submitButton);

      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onBack when the Back button is clicked', async () => {
      const user = userEvent.setup();
      const handleBack = vi.fn();

      render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={false}
          onSubmit={vi.fn()}
          onBack={handleBack}
        />
      );

      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(handleBack).toHaveBeenCalledTimes(1);
    });

    it('disables submit button and shows loading state when isSubmitting is true', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();

      render(
        <Step4Confirm
          formData={baseFormData}
          isSubmitting={true}
          onSubmit={handleSubmit}
          onBack={vi.fn()}
        />
      );

      const submitButton = screen.getByRole('button', { name: /Creating…/i });
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveAttribute('aria-busy', 'true');

      await user.click(submitButton);
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Step3Preview', () => {
    it('renders all vendor checklist categories from data with key badges', () => {
      render(<Step3Preview formData={baseFormData} />);

      expect(screen.getByRole('heading', { name: /Your Planning Preview/i })).toBeInTheDocument();
      expect(screen.getByText('6 categories')).toBeInTheDocument();

      expect(screen.getByText('Catering')).toBeInTheDocument();
      expect(screen.getByText('Photography')).toBeInTheDocument();
      expect(screen.getByText('Décor & Flowers')).toBeInTheDocument();
      expect(screen.getByText('Entertainment')).toBeInTheDocument();
      expect(screen.getByText('Transportation')).toBeInTheDocument();
      expect(screen.getByText('Invitations & Stationery')).toBeInTheDocument();

      // Required categories have 'Key' badge
      const keyBadges = screen.getAllByText('Key');
      expect(keyBadges).toHaveLength(2); // Catering & Photography
    });

    it('renders auto-generated timeline phases and countdown tasks', () => {
      render(<Step3Preview formData={baseFormData} />);

      expect(screen.getByText('Auto-Generated Timeline')).toBeInTheDocument();
      expect(screen.getByText('12+ months out')).toBeInTheDocument();
      expect(screen.getByText('6–12 months out')).toBeInTheDocument();
      expect(screen.getByText('1–6 months out')).toBeInTheDocument();
      expect(screen.getByText('Final weeks')).toBeInTheDocument();

      expect(screen.getByText('Set budget')).toBeInTheDocument();
      expect(screen.getByText('Choose venue')).toBeInTheDocument();
      expect(screen.getByText('Book caterer')).toBeInTheDocument();
      expect(screen.getByText('Confirm RSVPs')).toBeInTheDocument();
    });

    it('displays formatted event date in the timeline notice when eventDate is provided', () => {
      render(<Step3Preview formData={baseFormData} />);

      expect(
        screen.getByText(/Timeline is adjusted based on your event date:\s*December 25, 2026/i)
      ).toBeInTheDocument();
    });

    it('displays "not set" in the timeline notice when eventDate is empty', () => {
      render(<Step3Preview formData={{ ...baseFormData, eventDate: '' }} />);

      expect(
        screen.getByText(/Timeline is adjusted based on your event date:\s*not set/i)
      ).toBeInTheDocument();
    });
  });

  describe('Step2Budget', () => {
    it('updates budget input and fires updateField on change', async () => {
      const user = userEvent.setup();
      const updateField = vi.fn();

      render(
        <Step2Budget
          formData={baseFormData}
          errors={{}}
          updateField={updateField}
          totalBudgetAmount={5000}
        />
      );

      const budgetInput = screen.getByLabelText(/Total Budget/i);
      expect(budgetInput).toHaveValue(5000);

      await user.clear(budgetInput);
      await user.type(budgetInput, '7500');

      expect(updateField).toHaveBeenCalledWith('totalBudget', expect.any(String));
    });

    it('changes currency selector and fires updateField with selected currency', async () => {
      const user = userEvent.setup();
      const updateField = vi.fn();

      render(
        <Step2Budget
          formData={baseFormData}
          errors={{}}
          updateField={updateField}
          totalBudgetAmount={5000}
        />
      );

      const currencySelect = screen.getByLabelText(/Currency/i);
      expect(currencySelect).toHaveValue('USD');

      await user.selectOptions(currencySelect, 'EUR');
      expect(updateField).toHaveBeenCalledWith('currency', 'EUR');
    });

    it('updates total budget when a quick-select range button is clicked', async () => {
      const user = userEvent.setup();
      const updateField = vi.fn();

      render(
        <Step2Budget
          formData={baseFormData}
          errors={{}}
          updateField={updateField}
          totalBudgetAmount={5000}
        />
      );

      const modestRangeBtn = screen.getByRole('button', { name: /Modest 2k – 10k/i });
      await user.click(modestRangeBtn);

      expect(updateField).toHaveBeenCalledWith('totalBudget', '6000');
    });

    it('renders estimated allocation breakdown with role="progressbar" elements when totalBudget > 0', () => {
      render(
        <Step2Budget
          formData={baseFormData}
          errors={{}}
          updateField={vi.fn()}
          totalBudgetAmount={5000}
        />
      );

      expect(screen.getByText('Estimated allocation')).toBeInTheDocument();
      const progressbars = screen.getAllByRole('progressbar');
      expect(progressbars.length).toBe(baseFormData.budgetCategories.length);

      // Verify progressbar attributes
      expect(progressbars[0]).toHaveAttribute('aria-label', 'Venue allocation');
      expect(progressbars[0]).toHaveAttribute('aria-valuenow', '30');
    });

    it('omits allocation breakdown preview when totalBudgetAmount is 0', () => {
      render(
        <Step2Budget
          formData={{ ...baseFormData, totalBudget: '' }}
          errors={{}}
          updateField={vi.fn()}
          totalBudgetAmount={0}
        />
      );

      expect(screen.queryByText('Estimated allocation')).not.toBeInTheDocument();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
