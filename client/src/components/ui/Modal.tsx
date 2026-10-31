import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
  showCloseButton?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
};

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([type="hidden"]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

// Module-level reference counter to manage body scroll locking across multiple modal instances and React Strict Mode
let activeModalCount = 0;
let originalBodyOverflow: string | null = null;

function lockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  if (activeModalCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  activeModalCount++;
}

function unlockBodyScroll(): void {
  if (typeof document === 'undefined') return;
  activeModalCount = Math.max(0, activeModalCount - 1);
  if (activeModalCount === 0) {
    document.body.style.overflow = originalBodyOverflow ?? '';
    originalBodyOverflow = null;
  }
}

/**
 * Checks whether an element is truly visible and interactive.
 * Filters out hidden, aria-hidden, display:none, and visibility:hidden elements.
 */
function isElementFocusable(el: HTMLElement): boolean {
  if (el.hasAttribute('disabled') || (el as HTMLButtonElement | HTMLInputElement).disabled) {
    return false;
  }
  if (el instanceof HTMLInputElement && el.type === 'hidden') {
    return false;
  }
  if (el.hidden || el.hasAttribute('hidden')) {
    return false;
  }
  if (el.getAttribute('aria-hidden') === 'true') {
    return false;
  }
  if (el.closest('[hidden]') || el.closest('[aria-hidden="true"]')) {
    return false;
  }
  if (typeof window !== 'undefined' && window.getComputedStyle) {
    const style = window.getComputedStyle(el);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse'
    ) {
      return false;
    }
  }
  return true;
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return elements.filter(isElementFocusable);
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
  maxWidth = 'md',
  showCloseButton = true,
}: ModalProps) {
  const generatedId = useId();
  const titleId = `modal-title-${generatedId}`;
  const descId = description ? `modal-desc-${generatedId}` : undefined;

  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  // 1. Manage body scroll locking and capture the previous active element
  useEffect(() => {
    if (!isOpen) return;

    previousActiveElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
      const prevEl = previousActiveElementRef.current;
      if (
        prevEl &&
        document.contains(prevEl) &&
        typeof prevEl.focus === 'function' &&
        !prevEl.hasAttribute('disabled')
      ) {
        prevEl.focus();
      }
    };
  }, [isOpen]);

  // 2. Reliable initial focus management without arbitrary timeouts
  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const focusables = getFocusableElements(modalRef.current);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      modalRef.current.focus();
    }
  }, [isOpen]);

  // 3. Tab trapping & Escape-key handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = getFocusableElements(modalRef.current);

        // Case 1: Zero focusable children — prevent Tab from leaving the modal dialog container
        if (focusables.length === 0) {
          e.preventDefault();
          modalRef.current.focus();
          return;
        }

        // Case 2: Exactly one focusable element — keep focus on that element
        if (focusables.length === 1) {
          e.preventDefault();
          focusables[0].focus();
          return;
        }

        const firstElement = focusables[0];
        const lastElement = focusables[focusables.length - 1];

        if (e.shiftKey) {
          // Shift + Tab from first element (or modal container) wraps to last element
          if (document.activeElement === firstElement || document.activeElement === modalRef.current) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab from last element wraps to first element
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 4. Focus containment: prevent background content interaction while modal is active
  useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (e: FocusEvent) => {
      if (modalRef.current && e.target instanceof Node && !modalRef.current.contains(e.target)) {
        const focusables = getFocusableElements(modalRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          modalRef.current.focus();
        }
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    return () => document.removeEventListener('focusin', handleFocusIn);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        tabIndex={-1}
        className={cn(
          'bg-white rounded-3xl w-full p-6 shadow-xl border border-ivory-200 relative',
          'focus:outline-none max-h-[90vh] overflow-y-auto',
          maxWidthClasses[maxWidth],
          className
        )}
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 id={titleId} className="font-display text-xl font-bold text-charcoal">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-xs text-muted mt-1">
                {description}
              </p>
            )}
          </div>
          {showCloseButton && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="text-muted hover:text-charcoal p-1.5 rounded-xl hover:bg-ivory-100 transition-colors shrink-0 -mt-1 -mr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400"
            >
              <X size={18} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
