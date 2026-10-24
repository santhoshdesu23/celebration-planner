import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  ArrowRight,
  Calendar,
  Users,
  DollarSign,
  CheckSquare,
  Star,
  ChevronRight,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { Button, Badge, Card } from '@/components/ui';

// ── Data ─────────────────────────────────────────────────────────────────────

const eventCategories = [
  {
    id: 'wedding',
    emoji: '💍',
    label: 'Weddings',
    description: 'From intimate gatherings to grand celebrations',
    gradient: 'from-rose-50 to-pink-50',
    border: 'border-rose-100',
    count: '2.4k events planned',
  },
  {
    id: 'birthday',
    emoji: '🎂',
    label: 'Birthdays',
    description: 'Memorable parties for every age and milestone',
    gradient: 'from-amber-50 to-yellow-50',
    border: 'border-amber-100',
    count: '8.1k events planned',
  },
  {
    id: 'community',
    emoji: '🌿',
    label: 'Community Events',
    description: 'Festivals, fundraisers, and neighbourhood gatherings',
    gradient: 'from-emerald-50 to-teal-50',
    border: 'border-emerald-100',
    count: '1.2k events planned',
  },
  {
    id: 'corporate',
    emoji: '🏆',
    label: 'Corporate',
    description: 'Conferences, retreats, and team celebrations',
    gradient: 'from-sky-50 to-blue-50',
    border: 'border-sky-100',
    count: '3.8k events planned',
  },
  {
    id: 'anniversary',
    emoji: '✨',
    label: 'Anniversaries',
    description: 'Honour milestones with elegance and style',
    gradient: 'from-purple-50 to-violet-50',
    border: 'border-purple-100',
    count: '920 events planned',
  },
  {
    id: 'graduation',
    emoji: '🎓',
    label: 'Graduations',
    description: 'Celebrate achievements and new beginnings',
    gradient: 'from-indigo-50 to-blue-50',
    border: 'border-indigo-100',
    count: '1.6k events planned',
  },
];

const features = [
  {
    icon: <Sparkles className="text-gold" size={24} />,
    title: 'AI Planning Assistant',
    description:
      'Powered by Gemini AI, our assistant generates personalised themes, vendor suggestions, and timeline recommendations tailored to your event.',
    badge: 'AI-Powered',
    badgeVariant: 'gold' as const,
  },
  {
    icon: <DollarSign className="text-plum" size={24} />,
    title: 'Smart Budget Tracker',
    description:
      'Set your budget, track every penny across categories, and get real-time alerts when you approach limits — no spreadsheets needed.',
    badge: 'Real-time',
    badgeVariant: 'plum' as const,
  },
  {
    icon: <Calendar className="text-emerald-600" size={24} />,
    title: 'Dynamic Timeline',
    description:
      'Auto-generated milestones count down to your big day. Customise tasks, set reminders, and never miss a critical deadline.',
    badge: 'Auto-generated',
    badgeVariant: 'success' as const,
  },
  {
    icon: <CheckSquare className="text-sky-600" size={24} />,
    title: 'Vendor Checklist',
    description:
      'Manage caterers, photographers, florists, and more from one dashboard. Track quotes, bookings, and communications in one place.',
    badge: 'Organised',
    badgeVariant: 'info' as const,
  },
  {
    icon: <Users className="text-plum-400" size={24} />,
    title: 'Guest Management',
    description:
      'Track RSVPs, dietary preferences, and seating arrangements with an intuitive guest list manager.',
    badge: 'Coming soon',
    badgeVariant: 'default' as const,
  },
  {
    icon: <Star className="text-gold-400" size={24} />,
    title: 'Personalised Ideas',
    description:
      'Receive curated theme ideas, décor inspiration, and entertainment suggestions that match your vision and budget.',
    badge: 'AI-Curated',
    badgeVariant: 'gold' as const,
  },
];

const stats = [
  { value: '15k+', label: 'Events Planned' },
  { value: '98%', label: 'Happy Planners' },
  { value: '200+', label: 'Vendor Partners' },
  { value: '4.9★', label: 'Average Rating' },
];

const trustPoints = [
  { icon: <Zap size={18} />, text: 'Setup in under 2 minutes' },
  { icon: <Shield size={18} />, text: 'Your data stays private' },
  { icon: <Clock size={18} />, text: 'Save 20+ hours of planning' },
];

const testimonials = [
  {
    quote:
      'Celebration Planner turned months of wedding chaos into a joy. The AI suggestions were surprisingly on-point.',
    name: 'Priya Sharma',
    role: 'Bride, November wedding',
    avatar: 'PS',
  },
  {
    quote:
      'We organised our company\'s annual retreat for 300 people without breaking a sweat. Incredible tool.',
    name: 'Marcus Johnson',
    role: 'Events Director, TechCorp',
    avatar: 'MJ',
  },
  {
    quote:
      'The budget tracker alone is worth it. I stayed under budget for my daughter\'s sweet 16 for the first time ever!',
    name: 'Linda Torres',
    role: 'Parent & Party Enthusiast',
    avatar: 'LT',
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-hidden">
      {/* ══════════════════════════════════════════════════════════════════════
          HERO
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="hero"
        aria-label="Hero section"
        className="relative min-h-[92vh] flex items-center bg-gradient-ivory hero-pattern"
      >
        {/* Decorative blobs */}
        <div
          aria-hidden="true"
          className="absolute top-20 right-10 w-72 h-72 rounded-full bg-plum/5 blur-3xl animate-float pointer-events-none"
        />
        <div
          aria-hidden="true"
          className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-gold/8 blur-3xl animate-float-delayed pointer-events-none"
        />

        <div className="section-container relative z-10 py-24">
          <div className="max-w-3xl">
            {/* Eyebrow badge */}
            <div className="flex items-center gap-2 mb-6 animate-fade-in">
              <Badge variant="gold" dot>
                Powered by Gemini AI
              </Badge>
              <span className="text-xs text-muted">
                Hack2Skill PromptWars Challenge 5
              </span>
            </div>

            {/* Headline */}
            <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-bold leading-[1.1] text-charcoal mb-6 animate-slide-up">
              Plan Your{' '}
              <span className="relative inline-block">
                <span className="text-gradient-plum">Perfect</span>
                <svg
                  className="absolute -bottom-2 left-0 w-full"
                  viewBox="0 0 200 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 8 Q100 2 198 8"
                    stroke="#C9A84C"
                    strokeWidth="3"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </span>{' '}
              Celebration
            </h1>

            {/* Sub-headline */}
            <p className="text-lg sm:text-xl text-muted leading-relaxed max-w-2xl mb-8 animate-slide-up animation-delay-100">
              Weddings, birthdays, community events — our AI-powered assistant
              handles budgets, timelines, vendor checklists, and personalised
              ideas so you can focus on what matters: celebrating.
            </p>

            {/* Trust points */}
            <div className="flex flex-wrap gap-4 mb-10 animate-slide-up animation-delay-200">
              {trustPoints.map((tp) => (
                <div
                  key={tp.text}
                  className="flex items-center gap-2 text-sm text-charcoal-light"
                >
                  <span className="text-gold-500">{tp.icon}</span>
                  {tp.text}
                </div>
              ))}
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up animation-delay-300">
              <Button
                id="hero-plan-cta"
                variant="primary"
                size="xl"
                onClick={() => navigate('/create')}
                rightIcon={<ArrowRight size={20} />}
                leftIcon={<Sparkles size={18} />}
              >
                Plan a Celebration
              </Button>
              <Button
                id="hero-learn-cta"
                variant="ghost"
                size="xl"
                onClick={() =>
                  document
                    .getElementById('features')
                    ?.scrollIntoView({ behavior: 'smooth' })
                }
                rightIcon={<ChevronRight size={18} />}
              >
                See How It Works
              </Button>
            </div>
          </div>

          {/* Floating stat cards */}
          <div className="hidden lg:block absolute right-0 top-1/2 -translate-y-1/2">
            <div className="flex flex-col gap-4 animate-slide-in-right animation-delay-400">
              {stats.map((stat) => (
                <Card
                  key={stat.label}
                  variant="glass"
                  padding="sm"
                  className="text-center min-w-[140px] hover:scale-105 hover:shadow-card-hover transition-all duration-300"
                >
                  <p className="font-display text-2xl font-bold text-plum">
                    {stat.value}
                  </p>
                  <p className="text-xs text-muted">{stat.label}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom wave */}
        <div
          aria-hidden="true"
          className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none"
        >
          <svg
            viewBox="0 0 1440 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
            className="w-full h-16"
          >
            <path
              d="M0 80 Q360 0 720 40 Q1080 80 1440 20 L1440 80 Z"
              fill="white"
            />
          </svg>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          EVENT CATEGORIES
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="categories"
        aria-label="Event categories"
        className="py-24 bg-white"
      >
        <div className="section-container">
          <div className="text-center mb-14">
            <Badge variant="plum" className="mb-3">
              Every occasion covered
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-charcoal mb-4">
              What Are You{' '}
              <span className="text-gradient-plum">Celebrating?</span>
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              From intimate gatherings to grand galas, our planner adapts to
              any event type.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {eventCategories.map((cat, i) => (
              <button
                key={cat.id}
                id={`category-${cat.id}`}
                onClick={() => navigate(`/create?type=${cat.id}`)}
                aria-label={`Plan a ${cat.label} event`}
                className={`group text-left p-6 rounded-3xl border bg-gradient-to-br ${cat.gradient} ${cat.border}
                  hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300
                  animate-fade-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-400`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {cat.emoji}
                </div>
                <h3 className="font-display text-xl font-semibold text-charcoal mb-1.5">
                  {cat.label}
                </h3>
                <p className="text-sm text-muted mb-4">{cat.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted/80">{cat.count}</span>
                  <span className="text-plum group-hover:translate-x-1 transition-transform duration-200">
                    <ArrowRight size={16} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FEATURES
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="features"
        aria-label="Features"
        className="py-24 bg-gradient-ivory"
      >
        <div className="section-container">
          <div className="text-center mb-14">
            <Badge variant="gold" className="mb-3">
              Everything you need
            </Badge>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-charcoal mb-4">
              Your Complete{' '}
              <span className="text-gradient-gold">Planning Suite</span>
            </h2>
            <p className="text-muted max-w-xl mx-auto">
              Every tool you need to plan a flawless event — powered by AI,
              backed by data.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <Card
                key={feat.title}
                variant="default"
                padding="lg"
                hoverable
                className="animate-fade-in"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-12 h-12 rounded-2xl bg-ivory-100 flex items-center justify-center mb-4">
                  {feat.icon}
                </div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-display text-lg font-semibold text-charcoal">
                    {feat.title}
                  </h3>
                  <Badge variant={feat.badgeVariant} size="sm">
                    {feat.badge}
                  </Badge>
                </div>
                <p className="text-sm text-muted leading-relaxed">
                  {feat.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          TESTIMONIALS
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="testimonials"
        aria-label="Customer testimonials"
        className="py-24 bg-plum text-white"
      >
        <div className="section-container">
          <div className="text-center mb-14">
            <h2 className="font-display text-4xl sm:text-5xl font-bold mb-4">
              Loved by{' '}
              <span className="text-gradient-gold">Planners</span>
            </h2>
            <p className="text-white/60 max-w-xl mx-auto">
              Real stories from people who turned event stress into celebration
              joy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <blockquote
                key={t.name}
                className="glass-card bg-white/5 border-white/10 p-6 flex flex-col gap-4 hover:-translate-y-1 hover:border-gold/30 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex gap-1 text-gold-300">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} fill="currentColor" />
                  ))}
                </div>
                <p className="text-sm text-white/80 leading-relaxed italic">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <footer className="flex items-center gap-3 mt-auto">
                  <div className="w-10 h-10 rounded-full bg-gradient-gold flex items-center justify-center text-charcoal font-bold text-sm shrink-0">
                    {t.avatar}
                  </div>
                  <div>
                    <cite className="font-semibold text-white text-sm not-italic">
                      {t.name}
                    </cite>
                    <p className="text-xs text-white/50">{t.role}</p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          FINAL CTA
      ══════════════════════════════════════════════════════════════════════ */}
      <section
        id="cta"
        aria-label="Call to action"
        className="py-24 bg-white"
      >
        <div className="section-container">
          <div className="max-w-3xl mx-auto text-center">
            <div
              aria-hidden="true"
              className="w-20 h-20 rounded-full bg-gradient-plum mx-auto mb-6 flex items-center justify-center shadow-gold animate-pulse-gold"
            >
              <Sparkles size={32} className="text-gold-300" />
            </div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-charcoal mb-4">
              Ready to Start{' '}
              <span className="text-gradient-plum">Planning?</span>
            </h2>
            <p className="text-muted text-lg mb-8 max-w-xl mx-auto">
              Tell us about your event and our AI will build a personalised
              plan in seconds — complete with budget, timeline, and vendor
              checklist.
            </p>
            <Button
              id="final-plan-cta"
              variant="gold"
              size="xl"
              onClick={() => navigate('/create')}
              rightIcon={<ArrowRight size={20} />}
              leftIcon={<Sparkles size={18} />}
            >
              Start Planning — Free & Instant
            </Button>
            <p className="text-xs text-muted mt-4">
              No account required to generate your celebration plan • Sign up only when you want to save
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
