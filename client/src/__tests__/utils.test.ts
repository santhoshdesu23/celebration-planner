import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  formatDate,
  capitalise,
  formatEventType,
} from '../lib/utils';

describe('Client Utility Functions', () => {
  it('merges tailwind class names properly with cn', () => {
    expect(cn('px-4', 'py-2', 'px-6')).toBe('py-2 px-6');
    expect(cn('bg-red-500', undefined, 'text-white')).toBe('bg-red-500 text-white');
  });

  it('formats currency with currency symbol', () => {
    const usd = formatCurrency(25000, 'USD');
    expect(usd).toContain('25,000');
    expect(usd).toContain('$');

    const eur = formatCurrency(5000, 'EUR');
    expect(eur).toContain('5,000');
  });

  it('formats dates consistently', () => {
    const formatted = formatDate('2027-06-18T16:00:00.000Z');
    expect(formatted).toContain('2027');
    expect(formatted).toContain('June');
    expect(formatted).toContain('18');
  });

  it('capitalises strings', () => {
    expect(capitalise('wedding')).toBe('Wedding');
    expect(capitalise('birthday')).toBe('Birthday');
  });

  it('formats underscore event types into title words', () => {
    expect(formatEventType('wedding')).toBe('Wedding');
    expect(formatEventType('baby_shower')).toBe('Baby Shower');
    expect(formatEventType('community_event')).toBe('Community Event');
  });
});
