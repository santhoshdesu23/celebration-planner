import type {
  Event as EventType,
  CreateEventInput,
  UpdateEventInput,
  BudgetItem,
  TimelineItem,
  Vendor,
  AiIdea,
  AiAssistResponse,
  AiPlanStatusResponse,
  RegisterInput,
  LoginInput,
  UserResponse,
  SaveGuestPlanInput,
} from '@celebration-planner/shared';
import {
  getGuestDraft,
  setGuestDraft,
  addGuestBudgetItem,
  updateGuestBudgetItem,
  deleteGuestBudgetItem,
  addGuestTimelineItem,
  updateGuestTimelineItem,
  deleteGuestTimelineItem,
  addGuestVendor,
  updateGuestVendor,
  deleteGuestVendor,
  addGuestIdea,
  deleteGuestIdea,
  updateGuestEventDetails,
} from './guestDraft';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let currentCsrfToken: string | null = null;

function getCsrfTokenFromCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function getCsrfToken(): string | null {
  return currentCsrfToken || getCsrfTokenFromCookie();
}

async function request<T>(url: string, options?: RequestInit, isRetry = false): Promise<T> {
  const fullUrl = `${BASE_URL}${url}`;
  const method = (options?.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (isMutation) {
    headers['X-Requested-With'] = 'XMLHttpRequest';
    const csrf = getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }
  }

  const res = await fetch(fullUrl, {
    credentials: 'include',
    ...options,
    headers,
  });

  const json = await res.json().catch(() => null);

  // If CSRF token is invalid or missing, attempt to refresh token and retry once
  if (!res.ok && res.status === 403 && json?.error?.code === 'CSRF_ERROR' && !isRetry) {
    await api.refreshCsrfToken();
    return request<T>(url, options, true);
  }

  if (json?.data?.csrfToken && typeof json.data.csrfToken === 'string') {
    currentCsrfToken = json.data.csrfToken;
  }

  if (!res.ok || !json?.success) {
    const errorMsg = json?.error?.message || `Request failed with status ${res.status}`;
    const errorCode = json?.error?.code;
    throw new ApiError(errorMsg, res.status, errorCode);
  }

  return json.data as T;
}

export const api = {
  // CSRF token management
  setCsrfToken: (token: string | null) => {
    currentCsrfToken = token;
  },
  getCsrfToken: () => getCsrfToken(),
  refreshCsrfToken: async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/csrf-token`, { credentials: 'include' });
      const json = await res.json().catch(() => null);
      if (json?.data?.csrfToken) {
        currentCsrfToken = json.data.csrfToken;
        return currentCsrfToken;
      }
    } catch {
      // Ignore network errors during background CSRF sync
    }
    return getCsrfTokenFromCookie();
  },

  // Authentication
  register: (input: RegisterInput) =>
    request<{ user: UserResponse; token: string; csrfToken?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  login: (input: LoginInput) =>
    request<{ user: UserResponse; token: string; csrfToken?: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getMe: () =>
    request<{ user: UserResponse; csrfToken?: string }>('/api/auth/me'),

  logout: async () => {
    try {
      return await request<{ message: string }>('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      currentCsrfToken = null;
    }
  },

  // Health & Storage status
  getHealth: () =>
    request<{
      status: string;
      service: string;
      version: string;
      environment: string;
      timestamp: string;
      storage?: {
        type: 'mongodb' | 'in-memory';
        isDurable: boolean;
        warning?: string;
        error?: string;
      };
      aiProvider?: {
        configured: boolean;
        model: string;
        fallbackAvailable: boolean;
      };
    }>('/api/health'),

  // Events CRUD
  getEvents: (filter?: {
    type?: string;
    status?: string;
    limit?: number;
    skip?: number;
    summary?: boolean;
  }) => {
    const params = new URLSearchParams();
    if (filter?.type) params.set('type', filter.type);
    if (filter?.status) params.set('status', filter.status);
    if (filter?.limit !== undefined) params.set('limit', String(filter.limit));
    if (filter?.skip !== undefined) params.set('skip', String(filter.skip));
    if (filter?.summary !== undefined) params.set('summary', String(filter.summary));
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<EventType[]>(`/api/events${query}`);
  },

  getEvent: (id: string) => {
    if (id.startsWith('draft-') || id === 'guest') {
      const draft = getGuestDraft();
      if (!draft) return Promise.reject(new ApiError('Guest plan draft not found or expired', 404));
      return Promise.resolve(draft);
    }
    return request<EventType>(`/api/events/${id}`);
  },

  createEvent: (input: CreateEventInput) =>
    request<EventType>('/api/events', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Guest Celebration Planning
  generateGuestPlan: (input: CreateEventInput) =>
    request<EventType>('/api/events/guest-plan', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  saveGuestPlan: (input: SaveGuestPlanInput) =>
    request<EventType>('/api/events/save-guest-plan', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  askGuestAiAssist: (event: EventType, prompt: string, contextType: string = 'general') =>
    request<AiAssistResponse>('/api/events/guest-ai-assist', {
      method: 'POST',
      body: JSON.stringify({ event, prompt, contextType }),
    }),

  updateEvent: (id: string, updates: UpdateEventInput) => {
    if (id.startsWith('draft-') || id === 'guest') {
      return Promise.resolve(updateGuestEventDetails(updates as Partial<EventType>));
    }
    return request<EventType>(`/api/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteEvent: (id: string) =>
    request<{ deleted: boolean }>(`/api/events/${id}`, {
      method: 'DELETE',
    }),

  // AI Assistant
  askAiAssist: (id: string, prompt: string, contextType: string = 'general') => {
    if (id.startsWith('draft-') || id === 'guest') {
      const draft = getGuestDraft();
      if (!draft) return Promise.reject(new ApiError('Guest plan draft not found', 404));
      return api.askGuestAiAssist(draft, prompt, contextType);
    }
    return request<AiAssistResponse>(`/api/events/${id}/ai-assist`, {
      method: 'POST',
      body: JSON.stringify({ prompt, contextType }),
    });
  },

  regenerateAiPlan: (id: string) => {
    if (id.startsWith('draft-') || id === 'guest') {
      const draft = getGuestDraft();
      if (!draft) return Promise.reject(new ApiError('Guest plan draft not found', 404));
      return api.generateGuestPlan({
        title: draft.title,
        type: draft.type,
        eventDate: draft.eventDate,
        location: draft.location,
        guestCount: draft.guestCount,
        budget: draft.budget,
        description: draft.description,
      }).then((fresh) => {
        const updated = {
          ...draft,
          ideas: fresh.ideas,
        };
        setGuestDraft(updated);
        return updated;
      });
    }
    return request<EventType>(`/api/events/${id}/regenerate-ai`, {
      method: 'POST',
    });
  },

  getAiStatus: (id: string) =>
    request<AiPlanStatusResponse>(`/api/events/${id}/ai-status`),

  retryAiPlan: (id: string) =>
    request<EventType>(`/api/events/${id}/retry-ai`, {
      method: 'POST',
    }),

  // Budget Sub-items
  addBudgetItem: (eventId: string, item: Omit<BudgetItem, 'id'>) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(addGuestBudgetItem(item));
    }
    return request<EventType>(`/api/events/${eventId}/budget/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  updateBudgetItem: (
    eventId: string,
    itemId: string,
    updates: Partial<Omit<BudgetItem, 'id'>>
  ) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(updateGuestBudgetItem(itemId, updates));
    }
    return request<EventType>(`/api/events/${eventId}/budget/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteBudgetItem: (eventId: string, itemId: string) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(deleteGuestBudgetItem(itemId));
    }
    return request<EventType>(`/api/events/${eventId}/budget/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Timeline Sub-items
  addTimelineItem: (eventId: string, item: Omit<TimelineItem, 'id'>) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(addGuestTimelineItem(item));
    }
    return request<EventType>(`/api/events/${eventId}/timeline/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
  },

  updateTimelineItem: (
    eventId: string,
    itemId: string,
    updates: Partial<Omit<TimelineItem, 'id'>>
  ) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(updateGuestTimelineItem(itemId, updates));
    }
    return request<EventType>(`/api/events/${eventId}/timeline/items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteTimelineItem: (eventId: string, itemId: string) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(deleteGuestTimelineItem(itemId));
    }
    return request<EventType>(`/api/events/${eventId}/timeline/items/${itemId}`, {
      method: 'DELETE',
    });
  },

  // Vendor Sub-items
  addVendor: (eventId: string, vendor: Omit<Vendor, 'id'>) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(addGuestVendor(vendor));
    }
    return request<EventType>(`/api/events/${eventId}/vendors`, {
      method: 'POST',
      body: JSON.stringify(vendor),
    });
  },

  updateVendor: (
    eventId: string,
    vendorId: string,
    updates: Partial<Omit<Vendor, 'id'>>
  ) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(updateGuestVendor(vendorId, updates));
    }
    return request<EventType>(`/api/events/${eventId}/vendors/${vendorId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  deleteVendor: (eventId: string, vendorId: string) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(deleteGuestVendor(vendorId));
    }
    return request<EventType>(`/api/events/${eventId}/vendors/${vendorId}`, {
      method: 'DELETE',
    });
  },

  // Custom Ideas
  addIdea: (eventId: string, idea: Omit<AiIdea, 'id'>) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(addGuestIdea(idea));
    }
    return request<EventType>(`/api/events/${eventId}/ideas`, {
      method: 'POST',
      body: JSON.stringify(idea),
    });
  },

  deleteIdea: (eventId: string, ideaId: string) => {
    if (eventId.startsWith('draft-') || eventId === 'guest') {
      return Promise.resolve(deleteGuestIdea(ideaId));
    }
    return request<EventType>(`/api/events/${eventId}/ideas/${ideaId}`, {
      method: 'DELETE',
    });
  },
};
