import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { EventDashboardPage } from '../pages/EventDashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import {
  getGuestDraft,
  setGuestDraft,
  clearGuestDraft,
  hasGuestDraft,
  addGuestBudgetItem,
  updateGuestBudgetItem,
  deleteGuestBudgetItem,
  addGuestTimelineItem,
  updateGuestTimelineItem,
  deleteGuestTimelineItem,
  addGuestVendor,
  updateGuestVendor,
  deleteGuestVendor,
} from '../lib/guestDraft';
import { api } from '../lib/api';
import * as authContextModule from '../lib/authContext';
import type { Event as EventType } from '@celebration-planner/shared';

vi.mock('../lib/api', () => ({
  api: {
    getEvent: vi.fn(),
    getHealth: vi.fn().mockResolvedValue({ status: 'ok', storage: { isDurable: true } }),
    getAiStatus: vi.fn(),
    saveGuestPlan: vi.fn(),
    generateGuestPlan: vi.fn(),
    askGuestAiAssist: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('../lib/authContext', () => ({
  useAuth: vi.fn(),
}));

const sampleGuestPlan: EventType = {
  id: 'draft-test-123',
  ownerId: 'guest',
  title: 'Ruby Jubilee Grand Gala',
  type: 'anniversary',
  eventDate: '2028-11-15T18:00:00.000Z',
  guestCount: 80,
  location: 'Chicago, IL',
  status: 'draft',
  budget: {
    currency: 'USD',
    totalBudget: 25000,
    items: [
      {
        id: 'b-guest-1',
        category: 'Catering',
        estimatedAmount: 8000,
        actualAmount: 0,
        isPaid: false,
      },
    ],
  },
  timeline: [
    {
      id: 't-guest-1',
      title: 'Finalise Menu',
      dueDate: '2028-09-01T12:00:00.000Z',
      isCompleted: false,
    },
  ],
  vendors: [
    {
      id: 'v-guest-1',
      name: 'Artisan Caterers',
      category: 'Catering',
      status: 'contacted',
      estimatedCost: 8000,
      isAiSuggested: true,
    },
  ],
  ideas: [
    {
      id: 'i-guest-1',
      category: 'Décor',
      title: 'Crimson & Velvet Elegance',
      description: 'Deep red roses with velvet accents.',
      tags: ['Ruby', 'Velvet'],
    },
  ],
  aiSuggestionsGenerated: true,
  aiPlanStatus: 'completed',
  aiPlanRetryCount: 0,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
};

describe('Guest Planning Flow & Persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    (authContextModule.useAuth as any).mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    });
  });

  describe('Guest Draft Storage & Sub-resource Helpers', () => {
    it('saves and retrieves guest draft from session storage', () => {
      expect(hasGuestDraft()).toBe(false);
      setGuestDraft(sampleGuestPlan);
      expect(hasGuestDraft()).toBe(true);

      const retrieved = getGuestDraft();
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(sampleGuestPlan.id);
      expect(retrieved?.title).toBe(sampleGuestPlan.title);

      clearGuestDraft();
      expect(hasGuestDraft()).toBe(false);
      expect(getGuestDraft()).toBeNull();
    });

    it('handles malformed draft storage safely without throwing', () => {
      sessionStorage.setItem('celebration_guest_plan_draft', '{invalid-json-data');
      expect(getGuestDraft()).toBeNull();
      expect(hasGuestDraft()).toBe(false);
    });

    it('handles expired drafts safely', () => {
      const expiredDraft = {
        draftId: 'draft-expired',
        timestamp: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
        event: sampleGuestPlan,
      };
      sessionStorage.setItem('celebration_guest_plan_draft', JSON.stringify(expiredDraft));
      expect(getGuestDraft()).toBeNull();
      expect(hasGuestDraft()).toBe(false);
    });

    it('mutates budget items in-memory for guests', () => {
      setGuestDraft(sampleGuestPlan);

      // Add item
      const added = addGuestBudgetItem({
        category: 'Live Music',
        estimatedAmount: 3000,
        notes: 'Acoustic trio',
        isPaid: false,
      });
      expect(added.budget.items.length).toBe(2);
      const newItem = added.budget.items.find((i) => i.category === 'Live Music');
      expect(newItem).toBeDefined();

      // Update item
      const updated = updateGuestBudgetItem(newItem!.id, {
        actualAmount: 2800,
        isPaid: true,
      });
      const updatedItem = updated.budget.items.find((i) => i.id === newItem!.id);
      expect(updatedItem?.actualAmount).toBe(2800);
      expect(updatedItem?.isPaid).toBe(true);

      // Delete item
      const deleted = deleteGuestBudgetItem(newItem!.id);
      expect(deleted.budget.items.length).toBe(1);
    });

    it('mutates timeline and vendor items in-memory for guests', () => {
      setGuestDraft(sampleGuestPlan);

      // Timeline add & update & delete
      const withTimeline = addGuestTimelineItem({
        title: 'Send Invitations',
        dueDate: '2028-08-01T12:00:00.000Z',
        isCompleted: false,
      });
      const newMilestone = withTimeline.timeline.find((t) => t.title === 'Send Invitations');
      expect(newMilestone).toBeDefined();

      const completedTimeline = updateGuestTimelineItem(newMilestone!.id, { isCompleted: true });
      expect(completedTimeline.timeline.find((t) => t.id === newMilestone!.id)?.isCompleted).toBe(true);

      const deletedTimeline = deleteGuestTimelineItem(newMilestone!.id);
      expect(deletedTimeline.timeline.some((t) => t.id === newMilestone!.id)).toBe(false);

      // Vendor add & update & delete
      const withVendor = addGuestVendor({
        name: 'Floral Dreams',
        category: 'Flowers',
        status: 'quote_received',
        estimatedCost: 2000,
        isAiSuggested: false,
      });
      const newVendor = withVendor.vendors.find((v) => v.name === 'Floral Dreams');
      expect(newVendor).toBeDefined();

      const updatedVendor = updateGuestVendor(newVendor!.id, { status: 'booked', confirmedCost: 1900 });
      expect(updatedVendor.vendors.find((v) => v.id === newVendor!.id)?.status).toBe('booked');

      const deletedVendor = deleteGuestVendor(newVendor!.id);
      expect(deletedVendor.vendors.some((v) => v.id === newVendor!.id)).toBe(false);
    });
  });

  describe('Guest Dashboard UI', () => {
    it('displays unsaved guest banner and Save My Plan action', async () => {
      setGuestDraft(sampleGuestPlan);

      render(
        <MemoryRouter initialEntries={['/guest-plan']}>
          <Routes>
            <Route path="/guest-plan" element={<EventDashboardPage isGuest />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Ruby Jubilee Grand Gala')).toBeInTheDocument();
      });

      // Verify guest banner
      expect(screen.getByText(/Guest Celebration Plan — Not Yet Saved/i)).toBeInTheDocument();
      expect(screen.getByText('Unsaved Guest Plan')).toBeInTheDocument();

      // Verify Save My Plan buttons
      const saveButtons = screen.getAllByRole('button', { name: /save my plan/i });
      expect(saveButtons.length).toBeGreaterThanOrEqual(1);
    });

    it('clicking Save My Plan while unauthenticated redirects to login with redirect param', async () => {
      setGuestDraft(sampleGuestPlan);

      let currentPath = '';
      function PathTracker() {
        const loc = useLocation();
        currentPath = loc.pathname + loc.search;
        return <div data-testid="target-screen">Target</div>;
      }

      render(
        <MemoryRouter initialEntries={['/guest-plan']}>
          <Routes>
            <Route path="/guest-plan" element={<EventDashboardPage isGuest />} />
            <Route path="/login" element={<PathTracker />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Ruby Jubilee Grand Gala')).toBeInTheDocument();
      });

      const saveButtons = screen.getAllByRole('button', { name: /save my plan/i });
      expect(saveButtons.length).toBeGreaterThanOrEqual(1);
      fireEvent.click(saveButtons[0]);

      await waitFor(() => {
        expect(currentPath).toContain('/login?redirect=/guest-plan&save=true');
      });
    });
  });

  describe('Authentication Auto-Save Transfer Flow', () => {
    it('automatically saves guest plan and navigates to saved event after login', async () => {
      setGuestDraft(sampleGuestPlan);
      const user = userEvent.setup();

      const mockLogin = vi.fn().mockResolvedValue(undefined);
      (authContextModule.useAuth as any).mockReturnValue({
        user: { id: 'user-auth-123', name: 'Gala Planner', email: 'gala@example.com' },
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
      });

      (api.saveGuestPlan as any).mockResolvedValue({
        id: 'persisted-event-789',
        title: sampleGuestPlan.title,
      });

      let currentPath = '';
      function LocationDisplay() {
        const loc = useLocation();
        currentPath = loc.pathname;
        return <div>{loc.pathname}</div>;
      }

      render(
        <MemoryRouter initialEntries={['/login?redirect=/guest-plan&save=true']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/events/:id" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify notice banner for guest draft
      expect(screen.getByText(/Celebration Draft Ready/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/email address/i), 'gala@example.com');
      await user.type(screen.getByLabelText(/^Password/i), 'Password123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(api.saveGuestPlan).toHaveBeenCalled();
        expect(currentPath).toBe('/events/persisted-event-789');
        // Draft cleared after successful transfer
        expect(hasGuestDraft()).toBe(false);
      });
    });

    it('automatically saves guest plan and navigates to saved event after registration', async () => {
      setGuestDraft(sampleGuestPlan);
      const user = userEvent.setup();

      const mockRegister = vi.fn().mockResolvedValue(undefined);
      (authContextModule.useAuth as any).mockReturnValue({
        user: { id: 'user-new-456', name: 'New Planner', email: 'new@example.com' },
        isAuthenticated: true,
        isLoading: false,
        register: mockRegister,
      });

      (api.saveGuestPlan as any).mockResolvedValue({
        id: 'persisted-event-456',
        title: sampleGuestPlan.title,
      });

      let currentPath = '';
      function LocationDisplay() {
        const loc = useLocation();
        currentPath = loc.pathname;
        return <div>{loc.pathname}</div>;
      }

      render(
        <MemoryRouter initialEntries={['/register?redirect=/guest-plan&save=true']}>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/events/:id" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      // Verify notice banner for guest draft on register page
      expect(screen.getByText(/Celebration Plan Waiting/i)).toBeInTheDocument();

      await user.type(screen.getByLabelText(/full name/i), 'New Planner');
      await user.type(screen.getByLabelText(/email address/i), 'new@example.com');
      await user.type(screen.getByLabelText(/^Password/i), 'Password123!');
      await user.type(screen.getByLabelText(/confirm password/i), 'Password123!');
      await user.click(screen.getByRole('button', { name: /create account/i }));

      await waitFor(() => {
        expect(api.saveGuestPlan).toHaveBeenCalled();
        expect(currentPath).toBe('/events/persisted-event-456');
        expect(hasGuestDraft()).toBe(false);
      });
    });

    it('preserves guest draft for retry if saving to account fails', async () => {
      setGuestDraft(sampleGuestPlan);
      const user = userEvent.setup();

      const mockLogin = vi.fn().mockResolvedValue(undefined);
      (authContextModule.useAuth as any).mockReturnValue({
        user: { id: 'user-auth-123', name: 'Gala Planner', email: 'gala@example.com' },
        isAuthenticated: true,
        isLoading: false,
        login: mockLogin,
      });

      // Server error when saving
      (api.saveGuestPlan as any).mockRejectedValue(new Error('Database connectivity error'));

      function LocationDisplay() {
        const loc = useLocation();
        return <div data-testid="guest-plan-screen">{loc.pathname}</div>;
      }

      render(
        <MemoryRouter initialEntries={['/login?redirect=/guest-plan&save=true']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/guest-plan" element={<LocationDisplay />} />
          </Routes>
        </MemoryRouter>
      );

      await user.type(screen.getByLabelText(/email address/i), 'gala@example.com');
      await user.type(screen.getByLabelText(/^Password/i), 'Password123!');
      await user.click(screen.getByRole('button', { name: /sign in/i }));

      expect(await screen.findByTestId('guest-plan-screen')).toBeInTheDocument();
      expect(hasGuestDraft()).toBe(true);
    });
  });
});
