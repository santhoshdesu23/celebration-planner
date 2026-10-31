import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes intelligently, resolving conflicts */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formats a number as currency */
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Formats a date string to a readable format */
export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(dateStr));
}

/** Capitalises the first character of a string */
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Formats event type enum values to human-readable labels */
export function formatEventType(type: string): string {
  return type
    .split('_')
    .map((word) => capitalise(word))
    .join(' ');
}
/**
 * Returns `candidate` only when it is a same-origin, in-app path (e.g. "/events/123").
 * Rejects absolute URLs, protocol-relative ("//host"), backslash tricks ("/\host"), and control
 * characters so a crafted `?redirect=` value can never send users to another site.
 */
export function getSafeRedirectPath(candidate: unknown, fallback = '/events'): string {
  if (typeof candidate !== 'string') return fallback;
  const value = candidate.trim();
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1f\x7f]/.test(value)
  ) {
    return fallback;
  }
  return value;
}
