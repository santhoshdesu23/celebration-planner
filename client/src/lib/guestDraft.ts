import type {
  Event as EventType,
  BudgetItem,
  TimelineItem,
  Vendor,
  AiIdea,
} from '@celebration-planner/shared';

const GUEST_DRAFT_KEY = 'celebration_guest_plan_draft';
const MAX_DRAFT_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const MAX_DRAFT_SIZE_BYTES = 500 * 1024; // 500 KB limit

interface StoredDraftWrapper {
  draft: EventType;
  draftId: string;
  updatedAt: number;
}

// In-memory fallback if sessionStorage is blocked or unavailable
let memoryDraft: StoredDraftWrapper | null = null;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current session-scoped guest celebration draft.
 * Safely validates draft age and JSON structure.
 */
export function getGuestDraft(): EventType | null {
  const storage = getStorage();
  try {
    const raw = storage ? storage.getItem(GUEST_DRAFT_KEY) : null;
    let wrapper: StoredDraftWrapper | null = null;

    if (raw) {
      if (raw.length > MAX_DRAFT_SIZE_BYTES) {
        clearGuestDraft();
        return null;
      }
      wrapper = JSON.parse(raw);
    } else if (memoryDraft) {
      wrapper = memoryDraft;
    }

    if (!wrapper || !wrapper.draft || !wrapper.draft.id) {
      return null;
    }

    // Check expiration
    if (Date.now() - wrapper.updatedAt > MAX_DRAFT_AGE_MS) {
      clearGuestDraft();
      return null;
    }

    return wrapper.draft;
  } catch {
    clearGuestDraft();
    return null;
  }
}

/**
 * Gets the draft identifier for idempotency during save.
 */
export function getGuestDraftId(): string | null {
  const storage = getStorage();
  try {
    const raw = storage ? storage.getItem(GUEST_DRAFT_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.draftId || null;
    }
    return memoryDraft ? memoryDraft.draftId : null;
  } catch {
    return null;
  }
}

/**
 * Persists or updates the guest celebration draft in session storage.
 */
export function setGuestDraft(plan: EventType, draftId?: string): void {
  const storage = getStorage();
  const id = draftId || getGuestDraftId() || plan.id.replace('draft-', '') || crypto.randomUUID();
  const wrapper: StoredDraftWrapper = {
    draft: plan,
    draftId: id,
    updatedAt: Date.now(),
  };

  const serialized = JSON.stringify(wrapper);
  if (serialized.length > MAX_DRAFT_SIZE_BYTES) {
    console.warn('Guest plan draft exceeds maximum allowed size.');
    return;
  }

  memoryDraft = wrapper;
  if (storage) {
    try {
      storage.setItem(GUEST_DRAFT_KEY, serialized);
    } catch {
      // Session storage quota or private browsing restriction fallback
    }
  }
}

/**
 * Updates the guest draft in-place via an updater function.
 */
export function updateGuestDraft(updater: (prev: EventType) => EventType): EventType | null {
  const current = getGuestDraft();
  if (!current) return null;
  const updated = updater(current);
  setGuestDraft(updated);
  return updated;
}

/**
 * Clears the session-scoped guest draft after successful account transfer or reset.
 */
export function clearGuestDraft(): void {
  memoryDraft = null;
  const storage = getStorage();
  if (storage) {
    try {
      storage.removeItem(GUEST_DRAFT_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Checks if an active, unexpired guest celebration draft exists in this session.
 */
export function hasGuestDraft(): boolean {
  return getGuestDraft() !== null;
}

// ─── Sub-Resource Mutation Helpers for Guest Mode ───────────────────────────

export function addGuestBudgetItem(item: Omit<BudgetItem, 'id'>): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const newItem: BudgetItem = {
    ...item,
    id: crypto.randomUUID(),
  };
  const updated: EventType = {
    ...current,
    budget: {
      ...current.budget,
      items: [...current.budget.items, newItem],
    },
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function updateGuestBudgetItem(
  itemId: string,
  updates: Partial<Omit<BudgetItem, 'id'>>
): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    budget: {
      ...current.budget,
      items: current.budget.items.map((b: BudgetItem) => (b.id === itemId ? { ...b, ...updates } : b)),
    },
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function deleteGuestBudgetItem(itemId: string): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    budget: {
      ...current.budget,
      items: current.budget.items.filter((b: BudgetItem) => b.id !== itemId),
    },
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function addGuestTimelineItem(item: Omit<TimelineItem, 'id'>): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const newItem: TimelineItem = {
    ...item,
    id: crypto.randomUUID(),
  };
  const updated: EventType = {
    ...current,
    timeline: [...current.timeline, newItem],
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function updateGuestTimelineItem(
  itemId: string,
  updates: Partial<Omit<TimelineItem, 'id'>>
): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    timeline: current.timeline.map((t: TimelineItem) => (t.id === itemId ? { ...t, ...updates } : t)),
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function deleteGuestTimelineItem(itemId: string): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    timeline: current.timeline.filter((t: TimelineItem) => t.id !== itemId),
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function addGuestVendor(vendor: Omit<Vendor, 'id'>): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const newVendor: Vendor = {
    ...vendor,
    id: crypto.randomUUID(),
  };
  const updated: EventType = {
    ...current,
    vendors: [...current.vendors, newVendor],
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function updateGuestVendor(
  vendorId: string,
  updates: Partial<Omit<Vendor, 'id'>>
): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    vendors: current.vendors.map((v: Vendor) => (v.id === vendorId ? { ...v, ...updates } : v)),
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function deleteGuestVendor(vendorId: string): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    vendors: current.vendors.filter((v: Vendor) => v.id !== vendorId),
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function addGuestIdea(idea: Omit<AiIdea, 'id'>): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const newIdea: AiIdea = {
    ...idea,
    id: crypto.randomUUID(),
  };
  const updated: EventType = {
    ...current,
    ideas: [...current.ideas, newIdea],
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function deleteGuestIdea(ideaId: string): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    ideas: current.ideas.filter((i: AiIdea) => i.id !== ideaId),
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}

export function updateGuestEventDetails(updates: Partial<EventType>): EventType {
  const current = getGuestDraft();
  if (!current) throw new Error('No guest celebration draft active');
  const updated: EventType = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  setGuestDraft(updated);
  return updated;
}
