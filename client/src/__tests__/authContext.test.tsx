import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../lib/authContext';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getMe: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshCsrfToken: vi.fn(),
  },
}));

function ConsumerComponent() {
  const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();

  if (isLoading) return <div>Loading Auth State...</div>;

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'AUTHENTICATED' : 'ANONYMOUS'}</div>
      <div data-testid="user-name">{user?.name || 'No User'}</div>
      <button
        onClick={() => login({ email: 'test@example.com', password: 'Password123!' })}
      >
        Sign In
      </button>
      <button
        onClick={() =>
          register({ name: 'New User', email: 'new@example.com', password: 'Password123!' })
        }
      >
        Sign Up
      </button>
      <button onClick={() => logout()}>Sign Out</button>
    </div>
  );
}

describe('AuthContext & AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('restores authenticated user session on mount if getMe succeeds', async () => {
    (api.getMe as any).mockResolvedValueOnce({
      user: { id: 'u1', name: 'Alice Walker', email: 'alice@example.com' },
    });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    expect(screen.getByText('Loading Auth State...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Alice Walker');
    });

    expect(api.getMe).toHaveBeenCalledTimes(1);
  });

  it('sets anonymous state if getMe fails on mount', async () => {
    (api.getMe as any).mockRejectedValueOnce(new Error('Session expired'));

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
      expect(screen.getByTestId('user-name')).toHaveTextContent('No User');
    });
  });

  it('updates state upon successful login', async () => {
    (api.getMe as any).mockRejectedValueOnce(new Error('Not logged in'));
    (api.login as any).mockResolvedValueOnce({
      user: { id: 'u2', name: 'Bob Dylan', email: 'bob@example.com' },
    });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
    });

    await act(async () => {
      screen.getByText('Sign In').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Bob Dylan');
    });
  });

  it('updates state upon successful register', async () => {
    (api.getMe as any).mockRejectedValueOnce(new Error('Not logged in'));
    (api.register as any).mockResolvedValueOnce({
      user: { id: 'u3', name: 'Charlie Rose', email: 'charlie@example.com' },
    });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
    });

    await act(async () => {
      screen.getByText('Sign Up').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
      expect(screen.getByTestId('user-name')).toHaveTextContent('Charlie Rose');
    });
  });

  it('clears user session on logout', async () => {
    (api.getMe as any).mockResolvedValueOnce({
      user: { id: 'u1', name: 'Alice Walker', email: 'alice@example.com' },
    });
    (api.logout as any).mockResolvedValueOnce({ message: 'Success' });

    render(
      <AuthProvider>
        <ConsumerComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('AUTHENTICATED');
    });

    await act(async () => {
      screen.getByText('Sign Out').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('ANONYMOUS');
      expect(screen.getByTestId('user-name')).toHaveTextContent('No User');
    });
  });

  it('throws an error if useAuth is accessed outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<ConsumerComponent />)).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    consoleError.mockRestore();
  });
});
