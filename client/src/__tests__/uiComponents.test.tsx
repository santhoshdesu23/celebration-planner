import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  Badge,
  Button,
  Card,
  Input,
  Select,
  Spinner,
  EmptyState,
  ErrorState,
} from '../components/ui';

describe('Design System UI Components', () => {
  describe('Badge', () => {
    it('renders text with variant and size classes', () => {
      const { rerender } = render(<Badge variant="gold">VIP Access</Badge>);
      expect(screen.getByText('VIP Access')).toHaveClass('bg-gold-50', 'text-gold-600');

      rerender(
        <Badge variant="plum" size="md">
          Milestone
        </Badge>
      );
      expect(screen.getByText('Milestone')).toHaveClass('bg-plum-50', 'text-plum');
    });

    it('renders with dot indicator when dot prop is true', () => {
      const { container } = render(<Badge dot>Confirmed</Badge>);
      expect(container.querySelector('span span')).toBeInTheDocument();
    });
  });

  describe('Button', () => {
    it('renders children and handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Save Changes</Button>);

      const btn = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows loading spinner and disables button when loading', () => {
      const handleClick = vi.fn();
      render(
        <Button loading onClick={handleClick}>
          Submitting
        </Button>
      );

      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
      fireEvent.click(btn);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('renders left and right icons when provided', () => {
      render(
        <Button
          leftIcon={<span data-testid="left-icon">Left</span>}
          rightIcon={<span data-testid="right-icon">Right</span>}
        >
          Action
        </Button>
      );
      expect(screen.getByTestId('left-icon')).toBeInTheDocument();
      expect(screen.getByTestId('right-icon')).toBeInTheDocument();
    });
  });

  describe('Card', () => {
    it('renders card with padding and variants', () => {
      const { container } = render(
        <Card variant="glass" padding="lg">
          <div>Card Content</div>
        </Card>
      );
      expect(screen.getByText('Card Content')).toBeInTheDocument();
      expect(container.firstChild).toHaveClass('glass-card');
    });
  });

  describe('Input', () => {
    it('renders label, input, helper text, and error message', () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <Input
          label="Event Title"
          hint="Must be unique"
          value=""
          onChange={handleChange}
        />
      );

      expect(screen.getByLabelText('Event Title')).toBeInTheDocument();
      expect(screen.getByText('Must be unique')).toBeInTheDocument();

      rerender(
        <Input
          label="Event Title"
          error="Title is required"
          value=""
          onChange={handleChange}
        />
      );
      expect(screen.getByText('Title is required')).toBeInTheDocument();

      const input = screen.getByLabelText('Event Title');
      fireEvent.change(input, { target: { value: 'My Wedding' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Select', () => {
    it('renders select with options and handles value change', () => {
      const handleChange = vi.fn();
      render(
        <Select
          label="Currency"
          options={[
            { label: 'USD ($)', value: 'USD' },
            { label: 'EUR (€)', value: 'EUR' },
          ]}
          value="USD"
          onChange={handleChange}
        />
      );

      expect(screen.getByLabelText('Currency')).toBeInTheDocument();
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'EUR' } });
      expect(handleChange).toHaveBeenCalled();
    });
  });

  describe('Spinner', () => {
    it('renders with appropriate accessibility label', () => {
      render(<Spinner size="md" label="Fetching data..." />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Fetching data...')).toBeInTheDocument();
    });
  });

  describe('EmptyState & ErrorState', () => {
    it('renders empty state title, description, and action button', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          title="No Celebrations Found"
          description="You have not created any events yet."
          action={<Button onClick={onAction}>Plan Event</Button>}
        />
      );

      expect(screen.getByText('No Celebrations Found')).toBeInTheDocument();
      expect(screen.getByText('You have not created any events yet.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Plan Event' }));
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('renders error state with retry action', () => {
      const onRetry = vi.fn();
      render(
        <ErrorState
          title="Failed to Load"
          message="Server timed out."
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('Failed to Load')).toBeInTheDocument();
      expect(screen.getByText('Server timed out.')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
