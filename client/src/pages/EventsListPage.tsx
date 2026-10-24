import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  Plus,
  ArrowRight,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Button, Badge, Spinner } from '@/components/ui';
import { api } from '@/lib/api';
import { formatCurrency, formatEventType, formatDate } from '@/lib/utils';
import type { Event as EventType } from '@celebration-planner/shared';

export function EventsListPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getEvents({
        ...(filterType !== 'all' ? { type: filterType } : {}),
        summary: true,
      });
      setEvents(data);
    } catch (err: unknown) {
      console.error('Failed to load events:', err);
      setError(err instanceof Error ? err.message : 'Failed to load celebrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [filterType]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!window.confirm('Are you sure you want to delete this celebration?')) return;
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((ev) => ev.id !== id));
    } catch (err) {
      alert('Could not delete event');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-ivory py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-gold" />
              <span className="text-xs font-bold uppercase tracking-wider text-plum">
                Celebration Portfolio
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-charcoal">
              My Planned Celebrations
            </h1>
            <p className="text-muted text-sm mt-1">
              Manage your upcoming events, check timelines, and collaborate with AI.
            </p>
          </div>

          <Button
            variant="gold"
            size="lg"
            onClick={() => navigate('/create')}
            leftIcon={<Plus size={18} />}
          >
            Plan New Celebration
          </Button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'all', label: 'All Celebrations' },
            { id: 'wedding', label: 'Weddings' },
            { id: 'birthday', label: 'Birthdays' },
            { id: 'community', label: 'Community Events' },
            { id: 'anniversary', label: 'Anniversaries' },
            { id: 'corporate', label: 'Corporate' },
          ].map((pill) => (
            <button
              key={pill.id}
              onClick={() => setFilterType(pill.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                filterType === pill.id
                  ? 'bg-plum text-white shadow-xs'
                  : 'bg-white border border-ivory-200 text-charcoal hover:bg-ivory-100'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-4 rounded-2xl bg-crimson-50 border border-crimson-200 text-crimson text-sm">
            {error}
          </div>
        )}

        {/* Events Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Spinner size="lg" />
            <p className="mt-4 text-sm text-charcoal">Loading celebrations…</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-3xl border border-ivory-200 p-12 text-center max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-4 text-gold">
              <Calendar size={32} />
            </div>
            <h3 className="font-display text-xl font-bold text-charcoal mb-2">
              No celebrations found
            </h3>
            <p className="text-sm text-muted mb-6">
              {filterType === 'all'
                ? "You haven't planned any events yet. Get started in minutes with our AI assistant!"
                : `No events found for ${filterType}. Try switching filters or create one.`}
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={() => navigate('/create')}
              leftIcon={<Plus size={16} />}
            >
              Plan Your First Event
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => {
              const daysUntil = Math.ceil(
                (new Date(event.eventDate).getTime() - Date.now()) /
                  (1000 * 60 * 60 * 24)
              );
              const completedTasks = event.timeline.filter((t) => t.isCompleted).length;

              return (
                <div
                  key={event.id}
                  onClick={() => navigate(`/events/${event.id}`)}
                  className="bg-white rounded-3xl border border-ivory-200 hover:border-gold/60 p-6 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-28 h-28 bg-gradient-to-bl from-gold/10 to-transparent rounded-bl-full pointer-events-none" />

                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <Badge variant="gold" size="sm">
                        {formatEventType(event.type)}
                      </Badge>
                      <button
                        onClick={(e) => handleDelete(e, event.id)}
                        className="text-muted hover:text-red-600 p-1 rounded-lg transition-colors"
                        title="Delete celebration"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <h3 className="font-display text-xl font-bold text-charcoal mb-2 group-hover:text-plum transition-colors line-clamp-1">
                      {event.title}
                    </h3>

                    {event.description && (
                      <p className="text-xs text-muted line-clamp-2 italic mb-4">
                        &ldquo;{event.description}&rdquo;
                      </p>
                    )}

                    <div className="space-y-2 text-xs text-charcoal-light mb-6">
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className="text-plum shrink-0" />
                        <span>{formatDate(event.eventDate)}</span>
                        {daysUntil >= 0 && (
                          <span className="text-[11px] font-semibold text-plum-light bg-plum-50 px-2 py-0.5 rounded-full ml-auto">
                            {daysUntil === 0
                              ? 'Today!'
                              : daysUntil === 1
                              ? 'Tomorrow'
                              : `${daysUntil}d left`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-gold shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-muted shrink-0" />
                        <span>{event.guestCount} guests</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-green-700 shrink-0" />
                        <span className="font-semibold text-charcoal">
                          {formatCurrency(event.budget.totalBudget, event.budget.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-ivory-200 flex items-center justify-between text-xs">
                    <span className="text-muted">
                      {completedTasks}/{event.timeline.length} Milestones
                    </span>
                    <span className="font-semibold text-plum flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                      Open Dashboard <ArrowRight size={14} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
