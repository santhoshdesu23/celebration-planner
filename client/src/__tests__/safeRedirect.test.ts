import { describe, it, expect } from 'vitest';
import { getSafeRedirectPath } from '../lib/utils';

describe('getSafeRedirectPath (open-redirect regression)', () => {
  it('allows in-app absolute paths, including query strings', () => {
    expect(getSafeRedirectPath('/events')).toBe('/events');
    expect(getSafeRedirectPath('/events/abc-123?tab=budget')).toBe('/events/abc-123?tab=budget');
    expect(getSafeRedirectPath('/guest-plan')).toBe('/guest-plan');
  });

  it.each([
    ['https://evil.example'],
    ['http://evil.example/path'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['\\\\evil.example'],
    ['javascript:alert(1)'],
    ['evil.example'],
    ['/ok\nSet-Cookie:x'],
    ['   //evil.example'],
    [''],
  ])('rejects unsafe redirect %j and falls back', (value) => {
    expect(getSafeRedirectPath(value)).toBe('/events');
  });

  it('falls back for non-string input and honours a custom fallback', () => {
    expect(getSafeRedirectPath(undefined)).toBe('/events');
    expect(getSafeRedirectPath(null, '/')).toBe('/');
    expect(getSafeRedirectPath(42)).toBe('/events');
  });
});

