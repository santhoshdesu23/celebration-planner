import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { LoginPage } from '@/pages/LoginPage';
import * as authContextModule from '@/lib/authContext';

vi.mock('@/lib/authContext', () => ({
  useAuth: vi.fn(),
}));

describe('LoginPage Component', () => {
  const mockLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (authContextModule.useAuth as any).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: mockLogin,
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  const renderLoginPage = (initialEntries = ['/login']) => {
    let locationTracker: any;

    function LocationDisplay() {
      locationTracker = useLocation();
      return <div data-testid="location-display">{locationTracker.pathname}</div>;
    }

    const utils = render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/events" element={<LocationDisplay />} />
          <Route path="/custom-target" element={<LocationDisplay />} />
          <Route path="/register" element={<div data-testid="register-screen">Register Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    return {
      ...utils,
      getLocation: () => locationTracker,
    };
  };

  it('renders login form elements and navigation links', () => {
    renderLoginPage();

    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create an account/i })).toBeInTheDocument();
  });

  it('validates empty inputs and displays error message without calling login', async () => {
    renderLoginPage();

    // Submit form without entering email and password
    const submitBtn = screen.getByRole('button', { name: /sign in/i });
    fireEvent.submit(submitBtn.closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/please provide both email and password/i);
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('displays loading state during submission', async () => {
    const user = userEvent.setup();
    let resolveLogin: (value?: any) => void = () => {};
    mockLogin.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve;
        })
    );

    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeDisabled();

    // Resolve login promise
    resolveLogin();
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'Password123!',
      });
    });
  });

  it('navigates to default /events route upon successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'ValidPass123!',
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent('/events');
    });
  });

  it('navigates to return location specified in router state upon successful login', async () => {
    const user = userEvent.setup();
    mockLogin.mockResolvedValueOnce(undefined);

    renderLoginPage([
      { pathname: '/login', state: { from: '/custom-target' } } as any,
    ]);

    await user.type(screen.getByLabelText(/email address/i), 'user@example.com');
    await user.type(screen.getByLabelText(/password/i), 'ValidPass123!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/custom-target');
    });
  });

  it('displays server error message when login fails', async () => {
    const user = userEvent.setup();
    mockLogin.mockRejectedValueOnce(new Error('Invalid email or password.'));

    renderLoginPage();

    await user.type(screen.getByLabelText(/email address/i), 'bad@example.com');
    await user.type(screen.getByLabelText(/password/i), 'WrongPassword!');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/invalid email or password/i);
    expect(screen.getByRole('button', { name: /sign in/i })).not.toBeDisabled();
  });
});
