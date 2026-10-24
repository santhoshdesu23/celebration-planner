import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EventsListPage } from '../pages/EventsListPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    getEvents: vi.fn(),
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

    it('renders event cards when events are loaded', async () => {
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
