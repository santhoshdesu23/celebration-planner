import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Sparkles,
  Calendar,
  MapPin,
  Users,
  DollarSign,
  ArrowLeft,
  Clock,
  Trash2,
  Download,
  MessageSquare,
  AlertCircle,
  Edit3,
  Info,
} from 'lucide-react';
import { Button, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatEventType, formatDate } from '@/lib/utils';
import {
  IdeasTab,
  BudgetTab,
  TimelineTab,
  VendorsTab,
  AssistantTab,
  EditDetailsModal,
  EditExpenseModal,
  type ChatMessage,
} from '@/components/dashboard';
import { useAuth } from '@/lib/authContext';
import {
  getGuestDraft,
  setGuestDraft,
  clearGuestDraft,
  getGuestDraftId,
} from '@/lib/guestDraft';
import type { Event as EventType, BudgetItem } from '@celebration-planner/shared';

type Tab = 'ideas' | 'budget' | 'timeline' | 'vendors' | 'assistant';

// Session-level cache for storage durability info to avoid repeated redundant /api/health calls
let cachedStorageInfo: {
  type?: string;
  isDurable?: boolean;
  warning?: string;
} | null = null;

interface EventDashboardPageProps {
  isGuest?: boolean;
}

export function EventDashboardPage({ isGuest = false }: EventDashboardPageProps = {}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const isGuestMode = Boolean(isGuest || id?.startsWith('draft-') || id === 'guest');

  const [event, setEvent] = useState<EventType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('ideas');
  const [isSavingGuestPlan, setIsSavingGuestPlan] = useState(false);
  const [storageInfo, setStorageInfo] = useState<{
    type?: string;
    isDurable?: boolean;
    warning?: string;
  } | null>(cachedStorageInfo);

  // Modal States
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<BudgetItem | null>(null);

  // AI Assistant Chat State
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([
    'How can we reduce our venue or catering costs by 15%?',
    'Draft a friendly vendor inquiry email',
    'Generate a run-of-show schedule for the reception',
  ]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRetryingAi, setIsRetryingAi] = useState(false);

  // Fetch event
  const fetchEvent = async () => {
    try {
      setLoading(true);
      setError(null);

      // Handle guest planning mode from session storage
      if (isGuestMode) {
        const draft = getGuestDraft();
        if (draft) {
          setEvent(draft);
          if (messages.length === 0) {
            setMessages([
              {
                sender: 'ai',
                text: `👋 Hello! I am your Celebration AI Assistant for **${draft.title}**. You can ask me for budget trimming ideas, vendor inquiry templates, games, or run-of-show schedules!`,
                time: 'Just now',
              },
            ]);
          }
        } else {
          setError('No guest celebration plan found. Start by planning your celebration!');
        }
        setLoading(false);
        return;
      }

      if (!id) return;
      const data = await api.getEvent(id);
      setEvent(data);

      // Fetch storage durability info at most once per session
      if (!cachedStorageInfo) {
        try {
          const health = await api.getHealth();
          if (health?.storage) {
            cachedStorageInfo = health.storage;
            setStorageInfo(health.storage);
          }
        } catch {
          // Non-critical, ignore
        }
      }

      // Initialize assistant greeting
      if (messages.length === 0) {
        setMessages([
          {
            sender: 'ai',
            text: `👋 Hello! I am your Celebration AI Assistant for **${data.title}**. You can ask me for budget trimming ideas, vendor inquiry templates, games, or run-of-show schedules!`,
            time: 'Just now',
          },
        ]);
      }
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Could not load event plan';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [id, isGuestMode]);

  // Adaptive polling for AI completion when status is pending or processing
  useEffect(() => {
    if (isGuestMode || !id || !event) return;
    if (event.aiPlanStatus !== 'pending' && event.aiPlanStatus !== 'processing') return;

    let isMounted = true;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let delay = 1500;

    const poll = async () => {
      try {
        const statusRes = await api.getAiStatus(id);
        if (!isMounted) return;

        if (statusRes.aiPlanStatus === 'completed') {
          const updatedEvent = await api.getEvent(id);
          if (isMounted) {
            setEvent(updatedEvent);
            toast.success('🎉 Bespoke celebration plan ready with ideas and timeline!');
          }
          return;
        } else if (statusRes.aiPlanStatus === 'failed') {
          if (isMounted) {
            setEvent((prev) =>
              prev
                ? {
                    ...prev,
                    aiPlanStatus: 'failed',
                    aiPlanError: statusRes.aiPlanError || 'AI plan generation failed',
                  }
                : null
            );
            toast.error('AI plan generation encountered an issue. You can retry anytime.');
          }
          return;
        }
      } catch {
        // Non-fatal polling error; back off and retry
      }

      if (isMounted) {
        // Adaptive linear backoff: 1.5s -> 2.5s -> 3.5s -> max 4.5s
        delay = Math.min(delay + 1000, 4500);
        timeoutId = setTimeout(poll, delay);
      }
    };

    timeoutId = setTimeout(poll, delay);

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [id, event?.aiPlanStatus, isGuestMode]);

  // Memoized days until event & milestone counts
  const daysUntil = useMemo(() => {
    if (!event?.eventDate) return 0;
    const eventDateObj = new Date(event.eventDate);
    return Math.ceil((eventDateObj.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }, [event?.eventDate]);

  const completedMilestones = useMemo(
    () => (event?.timeline || []).filter((m) => m.isCompleted).length,
    [event?.timeline]
  );

  const handleRetryAi = async () => {
    if (!id || isRetryingAi) return;
    try {
      setIsRetryingAi(true);
      await api.retryAiPlan(id);
      setEvent((prev) =>
        prev
          ? {
              ...prev,
              aiPlanStatus: 'pending',
              aiPlanError: null,
            }
          : null
      );
      toast.success('Retrying celebration plan generation...');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to retry plan generation');
    } finally {
      setIsRetryingAi(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-ivory flex flex-col items-center justify-center py-24">
        <Spinner size="lg" />
        <p className="mt-4 text-charcoal font-medium">
          Loading your bespoke celebration plan…
        </p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-gradient-ivory flex flex-col items-center justify-center py-24 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4 text-red-600">
          <AlertCircle size={32} />
        </div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-2">
          {isGuestMode ? 'No Guest Plan Found' : 'Celebration Not Found'}
        </h2>
        <p className="text-muted max-w-md mb-6">
          {error || (isGuestMode ? 'Start by planning your celebration!' : "We couldn't retrieve this event. It may have been deleted or the link is invalid.")}
        </p>
        <Button variant="primary" onClick={() => navigate(isGuestMode ? '/create' : '/events')}>
          {isGuestMode ? 'Start Planning' : 'View All Celebrations'}
        </Button>
      </div>
    );
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────
  const handleDeleteEvent = async () => {
    if (
      !window.confirm(
        'Are you sure you want to delete this celebration plan? This action cannot be undone.'
      )
    ) {
      return;
    }
    try {
      if (isGuestMode) {
        clearGuestDraft();
        toast.success('Guest plan discarded');
        navigate('/');
        return;
      }
      await api.deleteEvent(event.id);
      toast.success('Celebration plan deleted');
      navigate('/events');
    } catch (err: unknown) {
      toast.error('Failed to delete event');
    }
  };

  const handleSaveGuestPlan = async () => {
    if (!event) return;
    if (!isAuthenticated) {
      setGuestDraft(event);
      navigate('/login?redirect=/guest-plan&save=true');
      return;
    }
    try {
      setIsSavingGuestPlan(true);
      const saved = await api.saveGuestPlan({
        draftId: getGuestDraftId() || event.id,
        title: event.title,
        type: event.type,
        eventDate: event.eventDate,
        location: event.location,
        guestCount: event.guestCount,
        description: event.description,
        budget: event.budget,
        timeline: event.timeline,
        vendors: event.vendors,
        ideas: event.ideas,
      });
      clearGuestDraft();
      toast.success('🎉 Celebration plan permanently saved to your account!');
      navigate(`/events/${saved.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save celebration plan');
    } finally {
      setIsSavingGuestPlan(false);
    }
  };

  const handleExportPlan = () => {
    try {
      const sanitizedTitle =
        event.title.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_') || 'celebration';
      const blob = new Blob([JSON.stringify(event, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', url);
      downloadAnchor.setAttribute('download', `${sanitizedTitle}_plan.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(url);
      toast.success('Event plan exported to JSON!');
    } catch (err) {
      toast.error('Failed to export event plan');
    }
  };

  const handleRegenerateIdeas = async () => {
    try {
      setIsRegenerating(true);
      const updated = await api.regenerateAiPlan(event.id);
      setEvent(updated);
      toast.success('✨ Fresh AI ideas & recommendations generated!');
    } catch (err: unknown) {
      toast.error('Could not refresh AI ideas');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleSendAssistantMessage = async (customPrompt?: string) => {
    if (!customPrompt?.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: customPrompt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await api.askAiAssist(event.id, customPrompt, activeTab);
      const aiMsg: ChatMessage = {
        sender: 'ai',
        text: res.response,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, aiMsg]);
      if (res.suggestions && Array.isArray(res.suggestions) && res.suggestions.length > 0) {
        setSuggestions(res.suggestions);
      }
    } catch (err: unknown) {
      toast.error('AI assistant was unable to reply. Please retry.');
    } finally {
      setChatLoading(false);
    }
  };

  const handleOpenEditExpense = (item: BudgetItem) => {
    setEditingExpense(item);
    setShowEditExpense(true);
  };

  return (
    <div className="min-h-screen bg-gradient-ivory py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to={isAuthenticated ? '/events' : '/'}
            className="flex items-center gap-2 text-sm text-muted hover:text-plum transition-colors group"
          >
            <ArrowLeft
              size={16}
              className="group-hover:-translate-x-1 transition-transform"
            />
            {isAuthenticated ? 'All Celebrations' : 'Back to Home'}
          </Link>
          <div className="flex items-center gap-2">
            {isGuestMode && (
              <Button
                variant="gold"
                size="sm"
                onClick={handleSaveGuestPlan}
                loading={isSavingGuestPlan}
                leftIcon={<Sparkles size={14} />}
                id="save-my-plan-top-btn"
              >
                Save My Plan
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditDetails(true)}
              leftIcon={<Edit3 size={14} />}
            >
              Edit Details
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPlan}
              leftIcon={<Download size={14} />}
            >
              Export JSON
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteEvent}
              className="text-red-600 hover:bg-red-50"
              leftIcon={<Trash2 size={14} />}
            >
              Delete
            </Button>
          </div>
        </div>

        {/* Guest Celebration Plan Banner */}
        {isGuestMode && (
          <div className="bg-gradient-to-r from-amber-500/10 via-gold-500/15 to-amber-500/10 border-2 border-gold-400/40 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 backdrop-blur-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gold/20 flex items-center justify-center shrink-0 text-gold-700">
                <Sparkles size={20} className="animate-spin-slow" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-charcoal text-base">
                    Guest Celebration Plan — Not Yet Saved
                  </span>
                  <Badge variant="gold" size="sm">Temporary Draft</Badge>
                </div>
                <p className="text-muted text-xs mt-0.5">
                  You can explore and edit your budget, timeline, and vendors. Log in or create an account to save it permanently.
                </p>
              </div>
            </div>
            <Button
              variant="gold"
              size="md"
              onClick={handleSaveGuestPlan}
              loading={isSavingGuestPlan}
              leftIcon={<Sparkles size={16} />}
              id="save-guest-plan-btn"
              className="shadow-md hover:shadow-lg whitespace-nowrap"
            >
              Save My Plan
            </Button>
          </div>
        )}

        {/* Persistence / In-Memory Status Banner */}
        {storageInfo && !storageInfo.isDurable && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
            <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Notice (Ephemeral In-Memory Mode):</span>{' '}
              {storageInfo.warning ||
                'MongoDB is currently disconnected. Changes are kept in memory for this session and will reset if the server restarts. Use "Export JSON" to preserve your celebration plan offline.'}
            </div>
            <button
              onClick={handleExportPlan}
              className="font-semibold underline hover:text-amber-700 whitespace-nowrap ml-2"
            >
              Backup JSON
            </button>
          </div>
        )}

        {/* AI Planning in Progress Banner */}
        {event && (event.aiPlanStatus === 'pending' || event.aiPlanStatus === 'processing') && (
          <div className="bg-gradient-to-r from-plum-50 via-gold-50/50 to-plum-50 border border-plum-200 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-plum-100">
              <Sparkles className="text-gold animate-pulse" size={24} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-display font-bold text-charcoal text-base">
                Crafting Your Bespoke AI Celebration Plan...
              </h3>
              <p className="text-muted text-xs mt-0.5">
                Our celebration AI is assembling tailored ideas, timeline milestones, and vendor recommendations. Your event and budget are safely saved.
              </p>
            </div>
            <div className="flex items-center gap-2 bg-white/90 px-4 py-2 rounded-full border border-plum-100 text-xs font-semibold text-plum shrink-0">
              <Spinner size="sm" />
              <span>Generating in background</span>
            </div>
          </div>
        )}

        {/* AI Planning Recoverable Error Banner */}
        {event && event.aiPlanStatus === 'failed' && (
          <div className="bg-red-50 border border-red-200 rounded-3xl p-5 flex flex-col sm:flex-row items-center gap-4 text-red-900 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center shrink-0 border border-red-200 text-red-600">
              <AlertCircle size={24} />
            </div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="font-display font-bold text-red-900 text-base">
                AI Plan Generation Paused
              </h3>
              <p className="text-red-700 text-xs mt-0.5">
                {event.aiPlanError ||
                  'The AI service encountered a temporary error. Your event details and budget are safely saved.'}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRetryAi}
              loading={isRetryingAi}
              className="bg-white hover:bg-red-50 border-red-300 text-red-800 shrink-0"
            >
              Retry Plan Generation
            </Button>
          </div>
        )}

        {/* ─── Hero Event Header ────────────────────────────────────────────── */}
        <div className="bg-white rounded-3xl border border-ivory-200 p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <Badge variant="gold" size="md">
                  {formatEventType(event.type)}
                </Badge>
                {isGuestMode ? (
                  <Badge variant="gold" size="sm">
                    Unsaved Guest Plan
                  </Badge>
                ) : (
                  <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-plum-50 text-plum border border-plum-100">
                    {event.status}
                  </span>
                )}
                {daysUntil >= 0 ? (
                  <Badge variant="plum" size="sm">
                    {daysUntil === 0
                      ? '🎉 TODAY!'
                      : daysUntil === 1
                      ? 'Tomorrow!'
                      : `${daysUntil} days to go`}
                  </Badge>
                ) : (
                  <Badge variant="default" size="sm">
                    Concluded
                  </Badge>
                )}
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal">
                {event.title}
              </h1>
              {event.description && (
                <p className="text-muted text-sm mt-2 italic max-w-2xl">
                  &ldquo;{event.description}&rdquo;
                </p>
              )}
            </div>

            {/* Quick Metrics Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-ivory-100 rounded-2xl p-3 text-center border border-ivory-200">
                <Calendar size={18} className="mx-auto text-plum mb-1" />
                <p className="text-xs text-muted">Date</p>
                <p className="text-xs sm:text-sm font-semibold text-charcoal truncate">
                  {formatDate(event.eventDate)}
                </p>
              </div>
              <div className="bg-ivory-100 rounded-2xl p-3 text-center border border-ivory-200">
                <MapPin size={18} className="mx-auto text-gold mb-1" />
                <p className="text-xs text-muted">Location</p>
                <p className="text-xs sm:text-sm font-semibold text-charcoal truncate">
                  {event.location.split(',')[0]}
                </p>
              </div>
              <div className="bg-ivory-100 rounded-2xl p-3 text-center border border-ivory-200">
                <Users size={18} className="mx-auto text-plum mb-1" />
                <p className="text-xs text-muted">Guests</p>
                <p className="text-xs sm:text-sm font-semibold text-charcoal">
                  {event.guestCount}
                </p>
              </div>
              <div className="bg-ivory-100 rounded-2xl p-3 text-center border border-ivory-200">
                <DollarSign size={18} className="mx-auto text-gold mb-1" />
                <p className="text-xs text-muted">Budget</p>
                <p className="text-xs sm:text-sm font-semibold text-charcoal truncate">
                  {formatCurrency(event.budget.totalBudget, event.budget.currency)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Navigation Tabs ──────────────────────────────────────────────── */}
        <div className="flex border-b border-ivory-200 overflow-x-auto gap-2 pb-px">
          {[
            { id: 'ideas', label: 'AI Ideas & Themes', icon: Sparkles, count: event.ideas.length },
            { id: 'budget', label: 'Budget Planner', icon: DollarSign, count: event.budget.items.length },
            { id: 'timeline', label: 'Milestones & Tasks', icon: Clock, count: `${completedMilestones}/${event.timeline.length}` },
            { id: 'vendors', label: 'Vendor Directory', icon: Users, count: event.vendors.length },
            { id: 'assistant', label: 'Celebration AI Chat', icon: MessageSquare },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap rounded-t-xl transition-all border-b-2 ${
                  isActive
                    ? 'border-gold text-plum bg-white shadow-sm'
                    : 'border-transparent text-muted hover:text-charcoal hover:bg-white/50'
                }`}
              >
                <Icon
                  size={16}
                  className={isActive ? 'text-gold' : 'text-muted'}
                />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-gold/20 text-plum-light font-bold'
                        : 'bg-ivory-200 text-muted'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ─── Active Tab Content ───────────────────────────────────────────── */}
        {activeTab === 'ideas' && (
          <IdeasTab
            ideas={event.ideas}
            isRegenerating={isRegenerating}
            onRegenerateIdeas={handleRegenerateIdeas}
            onSelectPrompt={(prompt) => {
              setActiveTab('assistant');
              handleSendAssistantMessage(prompt);
            }}
          />
        )}

        {activeTab === 'budget' && (
          <BudgetTab
            event={event}
            onEventUpdated={setEvent}
            onOpenEditExpense={handleOpenEditExpense}
          />
        )}

        {activeTab === 'timeline' && (
          <TimelineTab
            event={event}
            onEventUpdated={setEvent}
          />
        )}

        {activeTab === 'vendors' && (
          <VendorsTab
            event={event}
            onEventUpdated={setEvent}
          />
        )}

        {activeTab === 'assistant' && (
          <AssistantTab
            messages={messages}
            chatLoading={chatLoading}
            suggestions={suggestions}
            onSendMessage={handleSendAssistantMessage}
          />
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────── */}
      <EditDetailsModal
        isOpen={showEditDetails}
        event={event}
        onClose={() => setShowEditDetails(false)}
        onEventUpdated={setEvent}
      />

      <EditExpenseModal
        isOpen={showEditExpense}
        expense={editingExpense}
        eventId={event.id}
        currency={event.budget.currency}
        onClose={() => {
          setShowEditExpense(false);
          setEditingExpense(null);
        }}
        onEventUpdated={setEvent}
      />
    </div>
  );
}
