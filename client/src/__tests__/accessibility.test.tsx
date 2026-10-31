import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';
import { Modal, Button, Input, Select, CardTitle } from '../components/ui';
import { PageLayout } from '../components/layout/PageLayout';

// Mock AuthContext for PageLayout
vi.mock('../lib/authContext', () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

describe('Accessibility & WCAG 2.2 Compliance Suite', () => {
  describe('Modal Component (WCAG 2.1.1, 2.4.3, 4.1.2)', () => {
    beforeEach(() => {
      document.body.style.overflow = '';
    });

    afterEach(() => {
      document.body.style.overflow = '';
    });

    it('renders with dialog role, aria-modal, and accessible name and description', () => {
      const handleClose = vi.fn();
      render(
        <Modal
          isOpen={true}
          onClose={handleClose}
          title="Add Timeline Task"
          description="Enter task title and target due date"
        >
          <input data-testid="modal-input" placeholder="Task title" />
        </Modal>
      );

      const dialog = screen.getByRole('dialog', { name: 'Add Timeline Task' });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-describedby');

      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('moves initial focus into the dialog reliably without relying on arbitrary timeouts', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Focus Target Modal">
          <input data-testid="first-input" />
        </Modal>
      );

      // In the presence of a close button and an input, the close button is the first focusable element
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      expect(document.activeElement).toBe(closeBtn);
    });

    it('moves initial focus to the modal container when there are zero focusable children and close button is hidden', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Static Notice Dialog"
          showCloseButton={false}
        >
          <p>This is a purely informational notice.</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog', { name: 'Static Notice Dialog' });
      expect(document.activeElement).toBe(dialog);
    });

    it('dismisses when pressing the Escape key', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Escape Test Modal">
          <p>Modal content</p>
        </Modal>
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('dismisses when clicking the backdrop overlay', () => {
      const handleClose = vi.fn();
      const { container } = render(
        <Modal isOpen={true} onClose={handleClose} title="Backdrop Test">
          <p>Inner content</p>
        </Modal>
      );

      const backdrop = container.firstElementChild as HTMLElement;
      fireEvent.click(backdrop);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('manages body scroll lock when open and restores it when closed or unmounted', () => {
      const { rerender, unmount } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Scroll Lock Test">
          <p>Content</p>
        </Modal>
      );

      expect(document.body.style.overflow).toBe('hidden');

      rerender(
        <Modal isOpen={false} onClose={vi.fn()} title="Scroll Lock Test">
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('');

      // Mount again and verify unmount cleanup
      rerender(
        <Modal isOpen={true} onClose={vi.fn()} title="Scroll Lock Test">
          <p>Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      unmount();
      expect(document.body.style.overflow).toBe('');
    });

    it('handles multiple modal instances without premature body scroll unlocking', () => {
      const { unmount: unmount1 } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal 1">
          <p>Modal 1 Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      const { unmount: unmount2 } = render(
        <Modal isOpen={true} onClose={vi.fn()} title="Modal 2">
          <p>Modal 2 Content</p>
        </Modal>
      );
      expect(document.body.style.overflow).toBe('hidden');

      // Unmounting modal 2 leaves modal 1 active, so body remains locked
      unmount2();
      expect(document.body.style.overflow).toBe('hidden');

      // Unmounting modal 1 now restores body scroll
      unmount1();
      expect(document.body.style.overflow).toBe('');
    });

    it('traps focus inside the modal with Tab and Shift+Tab cycling', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Focus Trap Test">
          <input data-testid="field-1" />
          <input data-testid="field-2" />
        </Modal>
      );

      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      const field2 = screen.getByTestId('field-2');

      // Tabbing from last element (field2) wraps to first element (closeBtn)
      field2.focus();
      expect(document.activeElement).toBe(field2);

      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
      expect(document.activeElement).toBe(closeBtn);

      // Shift+Tabbing from first element (closeBtn) wraps to last element (field2)
      closeBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(field2);
    });

    it('safely retains focus inside modal when there is only one focusable element', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Single Focusable Modal"
          showCloseButton={false}
        >
          <button type="button" data-testid="lone-button">
            Confirm Action
          </button>
        </Modal>
      );

      const loneButton = screen.getByTestId('lone-button');
      loneButton.focus();
      expect(document.activeElement).toBe(loneButton);

      // Tab should stay on loneButton
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
      expect(document.activeElement).toBe(loneButton);

      // Shift+Tab should stay on loneButton
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(loneButton);
    });

    it('safely retains focus on dialog container when there are zero focusable children', () => {
      render(
        <Modal
          isOpen={true}
          onClose={vi.fn()}
          title="Zero Focusable Modal"
          showCloseButton={false}
        >
          <p>Pure read-only text content.</p>
        </Modal>
      );

      const dialog = screen.getByRole('dialog', { name: 'Zero Focusable Modal' });
      expect(document.activeElement).toBe(dialog);

      // Tab key keeps focus trapped on the container
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
      expect(document.activeElement).toBe(dialog);
    });

    it('restores focus to the element that opened the modal upon closing', () => {
      function OpenerTestComponent() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button
              type="button"
              data-testid="opener-button"
              onClick={() => setOpen(true)}
            >
              Open Dialog
            </button>
            <Modal isOpen={open} onClose={() => setOpen(false)} title="Restore Test">
              <button
                type="button"
                data-testid="inner-submit"
                onClick={() => setOpen(false)}
              >
                Done
              </button>
            </Modal>
          </div>
        );
      }

      render(<OpenerTestComponent />);

      const openerBtn = screen.getByTestId('opener-button');
      openerBtn.focus();
      expect(document.activeElement).toBe(openerBtn);

      // Open the modal
      fireEvent.click(openerBtn);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Close the modal
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      fireEvent.click(closeBtn);

      // Focus should be returned to the opener button
      expect(document.activeElement).toBe(openerBtn);
    });

    it('gracefully handles focus restoration if opener element was removed from the DOM', () => {
      function DynamicOpenerTest() {
        const [open, setOpen] = useState(false);
        const [showOpener, setShowOpener] = useState(true);

        return (
          <div>
            {showOpener && (
              <button
                type="button"
                data-testid="dynamic-opener"
                onClick={() => {
                  setOpen(true);
                  setShowOpener(false); // remove opener from DOM
                }}
              >
                Open and Destroy
              </button>
            )}
            <Modal isOpen={open} onClose={() => setOpen(false)} title="Destroy Opener Test">
              <button type="button" onClick={() => setOpen(false)}>
                Dismiss
              </button>
            </Modal>
          </div>
        );
      }

      render(<DynamicOpenerTest />);

      const opener = screen.getByTestId('dynamic-opener');
      opener.focus();
      fireEvent.click(opener);

      // Opener is removed, closing modal should not throw
      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      expect(() => fireEvent.click(closeBtn)).not.toThrow();
    });

    it('prevents background focus interaction by redirecting focus back into modal on focusin', () => {
      render(
        <div>
          <button type="button" data-testid="outside-button">
            Background Button
          </button>
          <Modal isOpen={true} onClose={vi.fn()} title="Focus Containment Test">
            <input data-testid="modal-input" />
          </Modal>
        </div>
      );

      const outsideButton = screen.getByTestId('outside-button');
      const closeButton = screen.getByRole('button', { name: /close dialog/i });

      // Simulate an unexpected focusin event on a background element
      fireEvent.focusIn(outsideButton);

      // Focus should immediately be redirected back inside the modal
      expect(document.activeElement).toBe(closeButton);
    });

    it('excludes disabled and hidden elements from the focusable sequence', () => {
      render(
        <Modal isOpen={true} onClose={vi.fn()} title="Exclusion Test">
          <input type="hidden" data-testid="hidden-input" />
          <button type="button" disabled data-testid="disabled-btn">
            Disabled Action
          </button>
          <div hidden>
            <button type="button" data-testid="hidden-container-btn">
              Hidden Container Action
            </button>
          </div>
          <button type="button" aria-hidden="true" data-testid="aria-hidden-btn">
            Aria Hidden Action
          </button>
          <input data-testid="active-input" placeholder="Valid Field" />
        </Modal>
      );

      const closeBtn = screen.getByRole('button', { name: /close dialog/i });
      const activeInput = screen.getByTestId('active-input');

      // Tabbing from activeInput should wrap to closeBtn, skipping all disabled/hidden controls
      activeInput.focus();
      fireEvent.keyDown(document, { key: 'Tab', code: 'Tab' });
      expect(document.activeElement).toBe(closeBtn);
    });
  });

  describe('PageLayout Skip Link (WCAG 2.4.1 Bypass Blocks)', () => {
    it('renders a skip to main content bypass link pointing to #main-content', () => {
      render(
        <MemoryRouter>
          <PageLayout />
        </MemoryRouter>
      );

      const skipLink = screen.getByRole('link', { name: /skip to main content/i });
      expect(skipLink).toBeInTheDocument();
      expect(skipLink).toHaveAttribute('href', '#main-content');

      const mainLandmark = screen.getByRole('main');
      expect(mainLandmark).toHaveAttribute('id', 'main-content');
    });
  });

  describe('Form Primitives Accessibility (WCAG 1.3.1, 3.3.1, 3.3.2)', () => {
    it('Button defaults type="button" and renders screen reader text when loading', () => {
      render(<Button loading>Save</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(screen.getByText('Loading…')).toHaveClass('sr-only');
    });

    it('Input associates label, error, and hint with correct ARIA attributes', () => {
      render(
        <Input
          label="Celebration Budget"
          required
          error="Budget must be greater than zero"
          hint="Include catering, venue, and decor"
        />
      );

      const input = screen.getByLabelText(/celebration budget/i);
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-required', 'true');
      expect(input).toHaveAttribute('aria-invalid', 'true');

      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Budget must be greater than zero');
      expect(errorAlert).toHaveClass('text-red-600');
    });

    it('Select associates label, options, and error with correct ARIA attributes', () => {
      render(
        <Select
          label="Event Status"
          required
          options={[
            { value: 'planning', label: 'Planning' },
            { value: 'confirmed', label: 'Confirmed' },
          ]}
          error="Status is required"
        />
      );

      const select = screen.getByLabelText(/event status/i);
      expect(select).toBeInTheDocument();
      expect(select).toHaveAttribute('aria-required', 'true');
      expect(select).toHaveAttribute('aria-invalid', 'true');

      const errorAlert = screen.getByRole('alert');
      expect(errorAlert).toHaveTextContent('Status is required');
      expect(errorAlert).toHaveClass('text-red-600');
    });

    it('CardTitle supports semantic heading levels through polymorphic "as" prop', () => {
      const { rerender } = render(<CardTitle as="h2">Celebration Highlights</CardTitle>);
      expect(screen.getByRole('heading', { level: 2, name: 'Celebration Highlights' })).toBeInTheDocument();

      rerender(<CardTitle as="h1">Main Event Details</CardTitle>);
      expect(screen.getByRole('heading', { level: 1, name: 'Main Event Details' })).toBeInTheDocument();
    });
  });
});
