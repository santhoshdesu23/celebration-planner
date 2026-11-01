import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CreateEventPage } from '../pages/CreateEventPage';
import { AuthContext } from '../lib/authContext';

vi.mock('../lib/api', () => ({
  api: {
    createEvent: vi.fn(),
  },
}));

const authValue = {
  user: { id: 'u1', name: 'User', email: 'user@example.com' },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  refreshUser: vi.fn(),
} as unknown as React.ContextType<typeof AuthContext>;

function renderAt(url: string) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[url]}>
        <CreateEventPage />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const typeSelect = () => screen.getByLabelText(/Event Type/i) as HTMLSelectElement;

describe('CreateEventPage ?type= URL parameter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-selects a valid event type', () => {
    renderAt('/create?type=wedding');
    expect(typeSelect().value).toBe('wedding');
  });

  it('accepts every valid type from the shared enum, including underscored ones', () => {
    renderAt('/create?type=baby_shower');
    expect(typeSelect().value).toBe('baby_shower');
  });

  it('ignores an unknown event type and leaves the field empty', () => {
    renderAt('/create?type=not-a-real-type');
    expect(typeSelect().value).toBe('');
  });

  it('ignores a non-string-like or script-like value without throwing', () => {
    renderAt('/create?type=%3Cscript%3Ealert(1)%3C%2Fscript%3E');
    expect(typeSelect().value).toBe('');
  });

  it('leaves the field empty when no type parameter is present', () => {
    renderAt('/create');
    expect(typeSelect().value).toBe('');
  });

  it('does not override a manual selection made after the prefill', () => {
    renderAt('/create?type=wedding');
    expect(typeSelect().value).toBe('wedding');

    fireEvent.change(typeSelect(), { target: { value: 'birthday' } });

    expect(typeSelect().value).toBe('birthday');
  });
});

