import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventsListPage } from '../pages/EventsListPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getEvents: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

describe('Pages: EventsListPage and NotFoundPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EventsListPage', () => {
    it('renders loading spinner initially, then renders empty state when no events exist', async () => {
      (api.getEvents as any).mockResolvedValueOnce([]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      // Shows loading text
      expect(screen.getByText(/loading celebrations/i)).toBeInTheDocument();

      // Transitions to empty state
      await waitFor(() => {
        expect(screen.getByText('No celebrations found')).toBeInTheDocument();
        expect(screen.getByText('Plan Your First Event')).toBeInTheDocument();
      });
    });

    it('renders event cards with native React Router Link with accessible name and destination', async () => {
      (api.getEvents as any).mockResolvedValueOnce([
        {
          id: 'e-1',
          title: 'Sophia & Lucas Wedding',
          type: 'wedding',
          eventDate: '2027-09-20T16:00:00.000Z',
          guestCount: 150,
          location: 'Napa Valley, CA',
          status: 'planning',
          budget: { currency: 'USD', totalBudget: 45000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
        },
      ]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Sophia & Lucas Wedding')).toBeInTheDocument();
        expect(screen.getByText('Napa Valley, CA')).toBeInTheDocument();
        expect(screen.getByText('150 guests')).toBeInTheDocument();
      });

      // Primary navigation link
      const navLink = screen.getByRole('link', {
        name: /open celebration dashboard for sophia & lucas wedding/i,
      });
      expect(navLink).toBeInTheDocument();
      expect(navLink).toHaveAttribute('href', '/events/e-1');
    });

    it('renders separate Delete button with descriptive accessible name without nesting inside link', async () => {
      (api.getEvents as any).mockResolvedValueOnce([
        {
          id: 'e-1',
          title: 'Sophia & Lucas Wedding',
          type: 'wedding',
          eventDate: '2027-09-20T16:00:00.000Z',
          guestCount: 150,
          location: 'Napa Valley, CA',
          status: 'planning',
          budget: { currency: 'USD', totalBudget: 45000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
        },
      ]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Sophia & Lucas Wedding')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: /delete celebration: sophia & lucas wedding/i,
      });
      expect(deleteButton).toBeInTheDocument();

      const navLink = screen.getByRole('link', {
        name: /open celebration dashboard for sophia & lucas wedding/i,
      });

      // Verify Delete button is NOT a descendant of the navigation link
      expect(navLink.contains(deleteButton)).toBe(false);
    });

    it('deleting an event does not trigger navigation and removes item on confirmation', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      (api.deleteEvent as any).mockResolvedValueOnce({ success: true });

      (api.getEvents as any).mockResolvedValueOnce([
        {
          id: 'e-1',
          title: 'Sophia & Lucas Wedding',
          type: 'wedding',
          eventDate: '2027-09-20T16:00:00.000Z',
          guestCount: 150,
          location: 'Napa Valley, CA',
          status: 'planning',
          budget: { currency: 'USD', totalBudget: 45000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
        },
      ]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Sophia & Lucas Wedding')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: /delete celebration: sophia & lucas wedding/i,
      });

      fireEvent.click(deleteButton);

      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this celebration?'
      );
      expect(api.deleteEvent).toHaveBeenCalledWith('e-1');

      await waitFor(() => {
        expect(screen.queryByText('Sophia & Lucas Wedding')).not.toBeInTheDocument();
      });
    });

    it('supports keyboard navigation allowing independent focus on Delete button and Navigation link', async () => {
      (api.getEvents as any).mockResolvedValueOnce([
        {
          id: 'e-1',
          title: 'Grand Anniversary Gala',
          type: 'anniversary',
          eventDate: '2027-11-15T18:00:00.000Z',
          guestCount: 200,
          location: 'Chicago, IL',
          status: 'planning',
          budget: { currency: 'USD', totalBudget: 50000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
        },
      ]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Grand Anniversary Gala')).toBeInTheDocument();
      });

      const deleteButton = screen.getByRole('button', {
        name: /delete celebration: grand anniversary gala/i,
      });
      const navLink = screen.getByRole('link', {
        name: /open celebration dashboard for grand anniversary gala/i,
      });

      deleteButton.focus();
      expect(document.activeElement).toBe(deleteButton);

      navLink.focus();
      expect(document.activeElement).toBe(navLink);
    });

    it('filter pills allow filtering by event type and update aria-pressed', async () => {
      (api.getEvents as any).mockResolvedValue([
        {
          id: 'e-1',
          title: 'Tech Summit Conference',
          type: 'corporate',
          eventDate: '2027-10-01T09:00:00.000Z',
          guestCount: 500,
          location: 'San Francisco, CA',
          status: 'confirmed',
          budget: { currency: 'USD', totalBudget: 100000, items: [] },
          timeline: [],
          vendors: [],
          ideas: [],
        },
      ]);

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Tech Summit Conference')).toBeInTheDocument();
      });

      const allPill = screen.getByRole('button', { name: 'All Celebrations' });
      expect(allPill).toHaveAttribute('aria-pressed', 'true');

      const corporatePill = screen.getByRole('button', { name: 'Corporate' });
      expect(corporatePill).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(corporatePill);

      await waitFor(() => {
        expect(corporatePill).toHaveAttribute('aria-pressed', 'true');
        expect(allPill).toHaveAttribute('aria-pressed', 'false');
      });
      expect(api.getEvents).toHaveBeenCalledWith({
        type: 'corporate',
        summary: true,
      });
    });

    it('displays error state when api.getEvents fails', async () => {
      (api.getEvents as any).mockRejectedValueOnce(new Error('Network error'));

      render(
        <MemoryRouter>
          <EventsListPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });
  });

  describe('NotFoundPage', () => {
    it('renders 404 message and action buttons', () => {
      render(
        <MemoryRouter>
          <NotFoundPage />
        </MemoryRouter>
      );

      expect(screen.getByText('404')).toBeInTheDocument();
      expect(screen.getByText('Page Not Found')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /go back/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /plan an event/i })).toBeInTheDocument();
    });
  });
});
