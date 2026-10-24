import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Navbar, Footer, PageLayout } from '../components/layout';
import { LandingPage } from '../pages/LandingPage';
import { CreateEventPage } from '../pages/CreateEventPage';
import { AuthContext } from '../lib/authContext';

vi.mock('../lib/api', () => ({
  api: {
    createEvent: vi.fn(),
  },
}));

const mockAuthValue = (
  isAuthenticated = false,
  user: any = null,
  logout = vi.fn().mockResolvedValue(undefined)
): any => ({
  user,
  isAuthenticated,
  isLoading: false,
  login: vi.fn(),
  register: vi.fn(),
  logout,
  refreshUser: vi.fn(),
});

describe('Layout and Core Pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Navbar Component', () => {
    it('renders guest navigation with Log In and Sign Up buttons', () => {
      render(
        <AuthContext.Provider value={mockAuthValue(false, null)}>
          <MemoryRouter>
            <Navbar />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText('Celebration')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument();
      expect(screen.queryByText('My Celebrations')).not.toBeInTheDocument();
    });

    it('renders authenticated navigation with avatar and handles logout', async () => {
      const mockLogout = vi.fn().mockResolvedValue(undefined);
      render(
        <AuthContext.Provider
          value={mockAuthValue(
            true,
            { id: 'u1', name: 'Alexander Hamilton', email: 'alex@example.com' },
            mockLogout
          )}
        >
          <MemoryRouter initialEntries={['/events']}>
            <Navbar />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      // Should show My Celebrations link
      expect(screen.getByRole('link', { name: /my celebrations/i })).toBeInTheDocument();
      // Should show user avatar initial 'A'
      expect(screen.getAllByText('A')[0]).toBeInTheDocument();

      // Open profile dropdown
      const profileBtn = screen.getByRole('button', { name: /user profile menu/i });
      fireEvent.click(profileBtn);

      expect(screen.getAllByText('Alexander Hamilton')[0]).toBeInTheDocument();
      expect(screen.getAllByText('alex@example.com')[0]).toBeInTheDocument();

      // Click sign out
      const signOutBtn = screen.getByRole('menuitem', { name: /log out/i });
      fireEvent.click(signOutBtn);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Footer Component', () => {
    it('renders footer links, copyright, and brand name', () => {
      render(
        <MemoryRouter>
          <Footer />
        </MemoryRouter>
      );

      expect(screen.getByText(/celebration planner/i)).toBeInTheDocument();
      expect(screen.getByText(/All rights reserved/i)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: /plan an event/i })).toBeInTheDocument();
    });
  });

  describe('PageLayout Component', () => {
    it('wraps routed Outlet content inside main element with Navbar and Footer', () => {
      render(
        <AuthContext.Provider value={mockAuthValue(false, null)}>
          <MemoryRouter initialEntries={['/']}>
            <Routes>
              <Route element={<PageLayout />}>
                <Route index element={<div data-testid="child-content">Child route content</div>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });
  });

  describe('LandingPage Component', () => {
    it('renders hero title, feature cards, and CTA buttons', () => {
      render(
        <AuthContext.Provider value={mockAuthValue(false, null)}>
          <MemoryRouter>
            <LandingPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(
        screen.getByRole('heading', { level: 1, name: /plan your perfect celebration/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Smart Budget Tracker')).toBeInTheDocument();
      expect(screen.getByText('Dynamic Timeline')).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /plan a celebration|plan my event/i })[0]).toBeInTheDocument();
    });
  });

  describe('CreateEventPage Component', () => {
    it('renders Step 1 Event Basics and advances to Step 2 when valid', async () => {
      render(
        <AuthContext.Provider value={mockAuthValue(true, { id: 'u1', name: 'User' })}>
          <MemoryRouter initialEntries={['/create']}>
            <CreateEventPage />
          </MemoryRouter>
        </AuthContext.Provider>
      );

      expect(screen.getByText(/Create Your Event/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Event Name/i)).toBeInTheDocument();

      // Fill in Step 1
      fireEvent.change(screen.getByLabelText(/Event Name/i), {
        target: { value: 'Anniversary Extravaganza' },
      });
      fireEvent.change(screen.getByLabelText(/Event Type/i), {
        target: { value: 'anniversary' },
      });
      fireEvent.change(screen.getByLabelText(/Event Date/i), {
        target: { value: '2028-06-15' },
      });
      fireEvent.change(screen.getByLabelText(/Location \/ Venue/i), {
        target: { value: 'Crystal Ballroom, Chicago' },
      });
      fireEvent.change(screen.getByLabelText(/Expected Guests/i), {
        target: { value: '75' },
      });

      // Next step
      const continueBtn = screen.getByRole('button', { name: /continue/i });
      fireEvent.click(continueBtn);

      await waitFor(() => {
        expect(screen.getByText(/Step 2 of 4/i)).toBeInTheDocument();
      });
    });
  });
});
