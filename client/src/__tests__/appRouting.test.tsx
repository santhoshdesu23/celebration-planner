import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getMe: vi.fn(),
  },
}));

describe('App Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.getMe as any).mockRejectedValue(new Error('Unauthenticated'));
  });

  it('renders LandingPage at root "/"', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /plan your/i })).toBeInTheDocument();
    });
  });

  it('renders LoginPage at "/login"', async () => {
    render(
      <MemoryRouter initialEntries={['/login']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /welcome back/i })).toBeInTheDocument();
    });
  });

  it('renders RegisterPage at "/register"', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /create an account/i })).toBeInTheDocument();
    });
  });

  it('renders CreateEventPage at "/create"', async () => {
    render(
      <MemoryRouter initialEntries={['/create']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /create your event/i })).toBeInTheDocument();
    });
  });

  it('renders NotFoundPage for unknown routes', async () => {
    render(
      <MemoryRouter initialEntries={['/unknown-route-12345']}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: /404/i })).toBeInTheDocument();
      expect(screen.getByText(/page not found/i)).toBeInTheDocument();
    });
  });
});
