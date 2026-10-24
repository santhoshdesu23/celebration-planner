import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RegisterPage } from '@/pages/RegisterPage';
import * as authContextModule from '@/lib/authContext';

vi.mock('@/lib/authContext', () => ({
  useAuth: vi.fn(),
}));

describe('RegisterPage Component', () => {
  const mockRegister = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (authContextModule.useAuth as any).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: mockRegister,
      logout: vi.fn(),
      refreshUser: vi.fn(),
    });
  });

  const renderRegisterPage = (initialEntries = ['/register']) => {
    let locationTracker: any;

    function LocationDisplay() {
      locationTracker = useLocation();
      return <div data-testid="location-display">{locationTracker.pathname}</div>;
    }

    const utils = render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/events" element={<LocationDisplay />} />
          <Route path="/login" element={<div data-testid="login-screen">Login Screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    return {
      ...utils,
      getLocation: () => locationTracker,
    };
  };

  it('renders register form inputs, submit button, and sign in link', () => {
    renderRegisterPage();

    expect(screen.getByRole('heading', { name: /create an account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates empty name input', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SecurePassword123!');
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/please provide your name/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates empty email input', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/^password/i), 'SecurePassword123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SecurePassword123!');
    fireEvent.submit(screen.getByRole('button', { name: /create account/i }).closest('form')!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/please provide a valid email address/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates minimum password length', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'short');
    await user.type(screen.getByLabelText(/confirm password/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/password must be at least 8 characters/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates that password and confirm password match', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'DifferentPassword456!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/passwords do not match/i);
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits valid registration data and navigates to /events', async () => {
    const user = userEvent.setup();
    mockRegister.mockResolvedValueOnce(undefined);

    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/email address/i), 'alex.morgan@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'SuperSecret123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'SuperSecret123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Alex Morgan',
        email: 'alex.morgan@example.com',
        password: 'SuperSecret123!',
      });
      expect(screen.getByTestId('location-display')).toHaveTextContent('/events');
    });
  });

  it('shows loading state on button during submission', async () => {
    const user = userEvent.setup();
    let resolveRegistration: (val?: any) => void = () => {};
    mockRegister.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRegistration = resolve;
        })
    );

    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/email address/i), 'alex@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const submitBtn = screen.getByRole('button');
    expect(submitBtn).toBeDisabled();

    resolveRegistration();
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
    });
  });

  it('displays error alert when registration fails on server', async () => {
    const user = userEvent.setup();
    mockRegister.mockRejectedValueOnce(new Error('An account with this email address already exists.'));

    renderRegisterPage();

    await user.type(screen.getByLabelText(/full name/i), 'Alex Morgan');
    await user.type(screen.getByLabelText(/email address/i), 'existing@example.com');
    await user.type(screen.getByLabelText(/^password/i), 'Password123!');
    await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/already exists/i);
    expect(screen.getByRole('button', { name: /create account/i })).not.toBeDisabled();
  });
});
