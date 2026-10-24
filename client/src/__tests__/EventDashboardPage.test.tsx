import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EventDashboardPage } from '../pages/EventDashboardPage';
import { api } from '../lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

vi.mock('../lib/api', () => ({
  api: {
    getEvent: vi.fn(),
    getHealth: vi.fn(),
    getAiStatus: vi.fn(),
    retryAiPlan: vi.fn(),
    deleteEvent: vi.fn(),
    askAiAssist: vi.fn(),
    regenerateAiPlan: vi.fn(),
    deleteBudgetItem: vi.fn(),
    updateBudgetItem: vi.fn(),
    updateTimelineItem: vi.fn(),
    deleteTimelineItem: vi.fn(),
    updateVendor: vi.fn(),
    deleteVendor: vi.fn(),
  },
}));

vi.mock('../lib/authContext', () => ({
  useAuth: vi.fn(() => ({
    isAuthenticated: true,
    user: { id: 'u-1', name: 'Tester', email: 'tester@example.com' },
    isLoading: false,
  })),
}));

const mockEvent: EventType = {
  id: 'evt-456',
  ownerId: 'u-1',
  title: 'Sapphire Anniversary Ball',
  type: 'anniversary',
  eventDate: '2028-09-20T19:00:00.000Z',
  guestCount: 120,
  location: 'Starlight Ballroom, SF',
  status: 'planning',
  budget: {
    currency: 'USD',
    totalBudget: 40000,
    items: [
      {
        id: 'b-1',
        category: 'Live Jazz Band',
        estimatedAmount: 6000,
        actualAmount: 5500,
        isPaid: true,
      },
    ],
  },
  timeline: [
    {
      id: 't-1',
      title: 'Book Photographer',
      dueDate: '2028-06-01T12:00:00.000Z',
      isCompleted: false,
    },
  ],
  vendors: [
    {
      id: 'v-1',
      name: 'Blue Note Quartet',
      category: 'Music',
      status: 'booked',
      estimatedCost: 6000,
      confirmedCost: 5500,
      isAiSuggested: false,
    },
  ],
  ideas: [
    {
      id: 'i-1',
      category: 'Theme & Décor',
      title: 'Sapphire & Silver Candlelight',
      description: 'Luminous blue glass centerpieces with silver taper candles.',
      tags: ['Sapphire', 'Silver'],
    },
  ],
  aiSuggestionsGenerated: true,
  aiPlanStatus: 'completed',
  aiPlanRetryCount: 0,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
};

describe('EventDashboardPage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading spinner initially, then displays event details and default Ideas tab', async () => {
    (api.getEvent as any).mockResolvedValueOnce(mockEvent);
    (api.getHealth as any).mockResolvedValueOnce({
      status: 'ok',
      storage: { type: 'mongodb', isDurable: true },
    });

    render(
      <MemoryRouter initialEntries={['/events/evt-456']}>
        <Routes>
          <Route path="/events/:id" element={<EventDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Shows loading initially
    expect(
      screen.getByText(/loading your bespoke celebration plan/i)
    ).toBeInTheDocument();

    // Resolves and displays title
    await waitFor(() => {
      expect(screen.getByText('Sapphire Anniversary Ball')).toBeInTheDocument();
      expect(screen.getByText('Starlight Ballroom')).toBeInTheDocument();
    });

    // Default tab is Ideas
    expect(
      screen.getByText('Sapphire & Silver Candlelight')
    ).toBeInTheDocument();
  });

  it('handles tab switching between Budget, Timeline, Vendors, and Assistant tabs', async () => {
    (api.getEvent as any).mockResolvedValue(mockEvent);
    (api.getHealth as any).mockResolvedValue({
      status: 'ok',
      storage: { type: 'mongodb', isDurable: true },
    });

    render(
      <MemoryRouter initialEntries={['/events/evt-456']}>
        <Routes>
          <Route path="/events/:id" element={<EventDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Sapphire Anniversary Ball')).toBeInTheDocument();
    });

    // Switch to Budget tab
    const budgetTabBtn = screen.getByRole('button', { name: /budget planner/i });
    fireEvent.click(budgetTabBtn);
    expect(screen.getByText('Target Budget')).toBeInTheDocument();
    expect(screen.getByText('Live Jazz Band')).toBeInTheDocument();

    // Switch to Timeline tab
    const timelineTabBtn = screen.getByRole('button', { name: /milestones & tasks/i });
    fireEvent.click(timelineTabBtn);
    expect(screen.getByText('Book Photographer')).toBeInTheDocument();

    // Switch to Vendors tab
    const vendorsTabBtn = screen.getByRole('button', { name: /vendor directory/i });
    fireEvent.click(vendorsTabBtn);
    expect(screen.getByText('Blue Note Quartet')).toBeInTheDocument();

    // Switch to Assistant tab
    const assistantTabBtn = screen.getByRole('button', { name: /celebration ai chat/i });
    fireEvent.click(assistantTabBtn);
    expect(screen.getByPlaceholderText(/ask anything/i)).toBeInTheDocument();
  });

  it('renders error state when event fetch fails and provides back button', async () => {
    (api.getEvent as any).mockRejectedValueOnce(new Error('Event not found or unauthorized'));

    render(
      <MemoryRouter initialEntries={['/events/evt-not-found']}>
        <Routes>
          <Route path="/events/:id" element={<EventDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/celebration not found/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /view all celebrations/i })).toBeInTheDocument();
    });
  });

  it('renders pending AI generation banner when aiPlanStatus is pending', async () => {
    const pendingEvent: EventType = {
      ...mockEvent,
      aiPlanStatus: 'pending',
    };
    (api.getEvent as any).mockResolvedValueOnce(pendingEvent);
    (api.getHealth as any).mockResolvedValueOnce({
      status: 'ok',
      storage: { type: 'mongodb', isDurable: true },
    });
    (api.getAiStatus as any).mockResolvedValue({
      aiPlanStatus: 'pending',
    });

    render(
      <MemoryRouter initialEntries={['/events/evt-456']}>
        <Routes>
          <Route path="/events/:id" element={<EventDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByText(/crafting your bespoke ai celebration plan/i)
      ).toBeInTheDocument();
    });
  });

  it('renders failed AI generation banner with retry button when aiPlanStatus is failed', async () => {
    const failedEvent: EventType = {
      ...mockEvent,
      aiPlanStatus: 'failed',
      aiPlanError: 'AI rate limit exceeded',
    };
    (api.getEvent as any).mockResolvedValueOnce(failedEvent);
    (api.getHealth as any).mockResolvedValueOnce({
      status: 'ok',
      storage: { type: 'mongodb', isDurable: true },
    });
    (api.retryAiPlan as any).mockResolvedValueOnce({ success: true, aiPlanStatus: 'pending' });

    render(
      <MemoryRouter initialEntries={['/events/evt-456']}>
        <Routes>
          <Route path="/events/:id" element={<EventDashboardPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/ai plan generation paused/i)).toBeInTheDocument();
      expect(screen.getByText(/ai rate limit exceeded/i)).toBeInTheDocument();
    });

    const retryBtn = screen.getByRole('button', { name: /retry plan generation/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(api.retryAiPlan).toHaveBeenCalledWith('evt-456');
    });
  });
});
