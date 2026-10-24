import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  BudgetTab,
  TimelineTab,
  VendorsTab,
  IdeasTab,
  AssistantTab,
} from '../components/dashboard';
import { api } from '../lib/api';
import type { Event as EventType } from '@celebration-planner/shared';

vi.mock('../lib/api', () => ({
  api: {
    deleteBudgetItem: vi.fn(),
    updateBudgetItem: vi.fn(),
    updateTimelineItem: vi.fn(),
    deleteTimelineItem: vi.fn(),
    updateVendor: vi.fn(),
    deleteVendor: vi.fn(),
  },
}));

const mockEvent: EventType = {
  id: 'evt-123',
  ownerId: 'u-1',
  title: 'Golden Jubilee Gala',
  type: 'anniversary',
  eventDate: '2027-10-15T18:00:00.000Z',
  guestCount: 100,
  location: 'Metropolitan Hall, NY',
  status: 'planning',
  budget: {
    currency: 'USD',
    totalBudget: 50000,
    items: [
      {
        id: 'b-1',
        category: 'Catering',
        estimatedAmount: 15000,
        actualAmount: 14500,
        isPaid: true,
        notes: 'Includes open bar',
      },
      {
        id: 'b-2',
        category: 'Live Music',
        estimatedAmount: 5000,
        actualAmount: 0,
        isPaid: false,
      },
    ],
  },
  timeline: [
    {
      id: 't-1',
      title: 'Send Invitations',
      description: 'Mail luxury gold-foil embossed invitations',
      dueDate: '2027-08-01T12:00:00.000Z',
      isCompleted: false,
      category: 'Stationery',
    },
    {
      id: 't-2',
      title: 'Finalize Menu Tasting',
      dueDate: '2027-09-01T12:00:00.000Z',
      isCompleted: true,
      category: 'Catering',
    },
  ],
  vendors: [
    {
      id: 'v-1',
      name: 'Grand Gourmet Catering',
      category: 'Catering',
      status: 'booked',
      estimatedCost: 15000,
      confirmedCost: 14500,
      contactEmail: 'chef@grandgourmet.com',
      isAiSuggested: false,
    },
    {
      id: 'v-2',
      name: 'Acoustic Harmonies Trio',
      category: 'Music',
      status: 'contacted',
      estimatedCost: 4800,
      isAiSuggested: true,
    },
  ],
  ideas: [
    {
      id: 'i-1',
      category: 'Theme & Décor',
      title: 'Midnight Velvet & Champagne Accents',
      description: 'Drape ballroom with rich midnight navy velvet and golden candlelit candelabras.',
      tags: ['Velvet', 'Gold Accents', 'Classic'],
    },
  ],
  aiSuggestionsGenerated: true,
  aiPlanStatus: 'completed',
  aiPlanRetryCount: 0,
  createdAt: '2026-10-24T00:00:00.000Z',
  updatedAt: '2026-10-24T00:00:00.000Z',
};

describe('Dashboard Component Tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BudgetTab', () => {
    it('renders budget metrics, itemized rows, and handles edit/delete expense', async () => {
      const onEventUpdated = vi.fn();
      const onOpenEditExpense = vi.fn();
      (api.deleteBudgetItem as any).mockResolvedValueOnce({
        ...mockEvent,
        budget: { ...mockEvent.budget, items: [mockEvent.budget.items[1]] },
      });

      render(
        <BudgetTab
          event={mockEvent}
          onEventUpdated={onEventUpdated}
          onOpenEditExpense={onOpenEditExpense}
        />
      );

      // Verify categories and notes
      expect(screen.getByText('Catering')).toBeInTheDocument();
      expect(screen.getByText('Live Music')).toBeInTheDocument();
      expect(screen.getByText(/Includes open bar/)).toBeInTheDocument();

      // Trigger Add Expense modal open
      const addBtn = screen.getByRole('button', { name: /add expense/i });
      fireEvent.click(addBtn);
      expect(screen.getByText('Add Budget Expense')).toBeInTheDocument();

      // Trigger Edit Expense
      const editButtons = screen.getAllByRole('button', { name: /edit expense/i });
      fireEvent.click(editButtons[0]);
      expect(onOpenEditExpense).toHaveBeenCalledWith(mockEvent.budget.items[0]);

      // Trigger Delete Expense
      const deleteButtons = screen.getAllByRole('button', { name: /delete expense/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(api.deleteBudgetItem).toHaveBeenCalledWith('evt-123', 'b-1');
        expect(onEventUpdated).toHaveBeenCalled();
      });
    });
    it('renders allocation warning and deficit warning when budget limits are exceeded', () => {
      const overBudgetEvent: EventType = {
        ...mockEvent,
        budget: {
          currency: 'USD',
          totalBudget: 10000,
          items: [
            {
              id: 'b-over',
              category: 'Venue & Production',
              estimatedAmount: 12000,
              actualAmount: 11000,
              isPaid: true,
            },
          ],
        },
      };

      render(
        <BudgetTab
          event={overBudgetEvent}
          onEventUpdated={vi.fn()}
          onOpenEditExpense={vi.fn()}
        />
      );

      expect(screen.getByText(/Budget Allocation Alert:/i)).toBeInTheDocument();
      expect(screen.getByText(/Actual Spending Deficit:/i)).toBeInTheDocument();
      expect(screen.getByText(/\$2,000/)).toBeInTheDocument(); // $12000 - $10000
    });
  });

  describe('TimelineTab', () => {
    it('renders milestone cards and handles toggle completion and deletion', async () => {
      const onEventUpdated = vi.fn();
      (api.updateTimelineItem as any).mockResolvedValueOnce({
        ...mockEvent,
        timeline: [
          { ...mockEvent.timeline[0], isCompleted: true },
          mockEvent.timeline[1],
        ],
      });
      (api.deleteTimelineItem as any).mockResolvedValueOnce({
        ...mockEvent,
        timeline: [mockEvent.timeline[1]],
      });

      render(<TimelineTab event={mockEvent} onEventUpdated={onEventUpdated} />);

      expect(screen.getByText('Send Invitations')).toBeInTheDocument();
      expect(screen.getByText('Finalize Menu Tasting')).toBeInTheDocument();

      // Open Add Milestone modal
      const addBtn = screen.getByRole('button', { name: /add milestone/i });
      fireEvent.click(addBtn);
      expect(screen.getByText('Add Timeline Milestone')).toBeInTheDocument();

      // Toggle milestone completion
      const toggleBtn = screen.getByLabelText(/mark milestone completed/i);
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(api.updateTimelineItem).toHaveBeenCalledWith('evt-123', 't-1', {
          isCompleted: true,
        });
        expect(onEventUpdated).toHaveBeenCalled();
      });

      // Delete milestone
      const deleteButtons = screen.getAllByRole('button', { name: /delete milestone/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(api.deleteTimelineItem).toHaveBeenCalledWith('evt-123', 't-1');
      });
    });

    it('renders Action Needed badge on uncompleted overdue milestones', () => {
      const overdueEvent: EventType = {
        ...mockEvent,
        timeline: [
          {
            id: 't-overdue',
            title: 'Book Photographer Deposit',
            dueDate: '2020-01-01T00:00:00.000Z',
            isCompleted: false,
            category: 'Photography',
          },
        ],
      };

      render(<TimelineTab event={overdueEvent} onEventUpdated={vi.fn()} />);
      expect(screen.getByText('Action Needed')).toBeInTheDocument();
    });
  });

  describe('VendorsTab', () => {
    it('renders vendor items, status badge, transparency advisory, and handles status change and deletion', async () => {
      const onEventUpdated = vi.fn();
      (api.updateVendor as any).mockResolvedValueOnce({
        ...mockEvent,
        vendors: [{ ...mockEvent.vendors[0], status: 'contacted' }],
      });
      (api.deleteVendor as any).mockResolvedValueOnce({
        ...mockEvent,
        vendors: [mockEvent.vendors[1]],
      });

      render(<VendorsTab event={mockEvent} onEventUpdated={onEventUpdated} />);

      expect(screen.getByText('Grand Gourmet Catering')).toBeInTheDocument();
      expect(screen.getByText('Acoustic Harmonies Trio')).toBeInTheDocument();
      expect(screen.getByText('AI Suggested')).toBeInTheDocument();
      expect(screen.getByText(/Planning Transparency & Pricing Advisory:/i)).toBeInTheDocument();
      expect(screen.getByText(/Confirmed Quote:/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Benchmark Estimate:/i).length).toBeGreaterThanOrEqual(1);

      // Open Add Vendor modal
      const addBtn = screen.getByRole('button', { name: /add vendor/i });
      fireEvent.click(addBtn);
      expect(screen.getByText('Add Vendor to Directory')).toBeInTheDocument();

      // Change vendor status
      const statusSelects = screen.getAllByRole('combobox');
      fireEvent.change(statusSelects[0], { target: { value: 'contacted' } });

      await waitFor(() => {
        expect(api.updateVendor).toHaveBeenCalledWith('evt-123', 'v-1', {
          status: 'contacted',
        });
      });

      // Delete vendor
      const deleteButtons = screen.getAllByRole('button', { name: /delete vendor/i });
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(api.deleteVendor).toHaveBeenCalledWith('evt-123', 'v-1');
      });
    });
  });

  describe('IdeasTab', () => {
    it('renders AI ideas, tags, and handles regenerate and prompt selection', () => {
      const onRegenerate = vi.fn();
      const onSelectPrompt = vi.fn();

      render(
        <IdeasTab
          ideas={mockEvent.ideas}
          isRegenerating={false}
          onRegenerateIdeas={onRegenerate}
          onSelectPrompt={onSelectPrompt}
        />
      );

      expect(screen.getByText('Midnight Velvet & Champagne Accents')).toBeInTheDocument();
      expect(screen.getByText(/#\s*Velvet/)).toBeInTheDocument();
      expect(screen.getByText(/#\s*Gold Accents/)).toBeInTheDocument();

      // Refresh AI Ideas button
      const refreshBtn = screen.getByRole('button', { name: /refresh ai ideas/i });
      fireEvent.click(refreshBtn);
      expect(onRegenerate).toHaveBeenCalledTimes(1);

      // Prompt shortcut button
      const promptBtn = screen.getByText(/Suggest 3 creative interactive guest icebreakers/i);
      fireEvent.click(promptBtn);
      expect(onSelectPrompt).toHaveBeenCalledWith(
        'Suggest 3 creative interactive guest icebreakers'
      );
    });
  });

  describe('AssistantTab', () => {
    it('renders chat message history and handles sending prompt message', async () => {
      const onSendMessage = vi.fn().mockResolvedValue(undefined);
      const messages = [
        { sender: 'ai' as const, text: 'Hello! I am your planner assistant.', time: '10:00 AM' },
        { sender: 'user' as const, text: 'Can you suggest songs?', time: '10:01 AM' },
      ];

      render(
        <AssistantTab
          messages={messages}
          chatLoading={false}
          suggestions={['Draft a vendor inquiry email', 'Suggest budget cuts']}
          onSendMessage={onSendMessage}
        />
      );

      expect(screen.getByText('Hello! I am your planner assistant.')).toBeInTheDocument();
      expect(screen.getByText('Can you suggest songs?')).toBeInTheDocument();

      // Verify clickable suggestion chips
      const chipBtn = screen.getByText(/💡 Draft a vendor inquiry email/i);
      fireEvent.click(chipBtn);
      expect(onSendMessage).toHaveBeenCalledWith('Draft a vendor inquiry email');

      // Submit prompt via input form
      const input = screen.getByPlaceholderText(/ask anything/i);
      fireEvent.change(input, { target: { value: 'How to save money?' } });

      const sendBtn = screen.getByRole('button', { name: /send/i });
      fireEvent.click(sendBtn);

      expect(onSendMessage).toHaveBeenCalledWith('How to save money?');
    });
  });
});
