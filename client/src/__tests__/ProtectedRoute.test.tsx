import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import * as authContextModule from '@/lib/authContext';

vi.mock('@/lib/authContext', () => ({
  useAuth: vi.fn(),
}));

describe('ProtectedRoute Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialEntries = ['/protected']) => {
    let locationState: any;

    function MockLogin() {
      const loc = useLocation();
      locationState = loc.state;
      return <div data-testid="login-page">Login Page (Redirected from: {locationState?.from})</div>;
    }

    const utils = render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div data-testid="protected-content">Secret Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<MockLogin />} />
        </Routes>
      </MemoryRouter>
    );

    return {
      ...utils,
      getLocationState: () => locationState,
    };
  };

  it('renders loading session indicator when auth is loading', () => {
    (authContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    renderWithRouter();

    expect(screen.getByText(/verifying session/i)).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to /login preserving intended location in state', () => {
    (authContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    const { getLocationState } = renderWithRouter(['/protected']);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(getLocationState()).toEqual({ from: '/protected' });
  });

  it('renders protected child component when user is authenticated and not loading', () => {
    (authContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'u1', name: 'Authorized User', email: 'auth@example.com' },
    });

    renderWithRouter();

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByText(/verifying session/i)).not.toBeInTheDocument();
  });

  it('renders null when authenticated but no children are provided', () => {
    (authContextModule.useAuth as any).mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
      user: { id: 'u1', name: 'Authorized User', email: 'auth@example.com' },
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/empty-protected']}>
        <Routes>
          <Route path="/empty-protected" element={<ProtectedRoute />} />
        </Routes>
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
