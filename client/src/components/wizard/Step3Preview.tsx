import { Camera, Music, Utensils, Flower2, Car, Palette } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { WizardFormData } from '@/hooks/useEventWizard';

interface Step3Props {
  formData: WizardFormData;
}

const vendorCategories = [
  {
    icon: <Utensils size={22} className="text-amber-600" />,
    name: 'Catering',
    description: 'Food, beverages, and wait staff',
    required: true,
  },
  {
    icon: <Camera size={22} className="text-sky-600" />,
    name: 'Photography',
    description: 'Photographers and videographers',
    required: true,
  },
  {
    icon: <Flower2 size={22} className="text-rose-500" />,
    name: 'Décor & Flowers',
    description: 'Florists, décor rentals, and styling',
    required: false,
  },
  {
    icon: <Music size={22} className="text-violet-600" />,
    name: 'Entertainment',
    description: 'DJs, bands, and performers',
    required: false,
  },
  {
    icon: <Car size={22} className="text-emerald-600" />,
    name: 'Transportation',
    description: 'Shuttle services and luxury transport',
    required: false,
  },
  {
    icon: <Palette size={22} className="text-pink-500" />,
    name: 'Invitations & Stationery',
    description: 'Invites, menus, and table cards',
    required: false,
  },
];

const timelinePhases = [
  {
    phase: '12+ months out',
    tasks: ['Set budget', 'Choose venue', 'Book photographer'],
    color: 'bg-plum-100 text-plum',
  },
  {
    phase: '6–12 months out',
    tasks: ['Send invitations', 'Book caterer', 'Plan décor'],
    color: 'bg-gold-100 text-gold-700',
  },
  {
    phase: '1–6 months out',
    tasks: ['Confirm vendors', 'Finalise menu', 'Plan seating'],
    color: 'bg-emerald-100 text-emerald-700',
  },
  {
    phase: 'Final weeks',
    tasks: ['Confirm RSVPs', 'Final payments', 'Day-of timeline'],
    color: 'bg-sky-100 text-sky-700',
  },
];

export function Step3Preview({ formData }: Step3Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-1">
          Your Planning Preview
        </h2>
        <p className="text-muted text-sm">
          Here&apos;s what we&apos;ll set up for you — all customisable after
          creation.
        </p>
      </div>

      {/* Vendor categories */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-charcoal">
            Vendor Checklist
          </h3>
          <Badge variant="plum" size="sm">
            {vendorCategories.length} categories
          </Badge>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {vendorCategories.map((v) => (
            <div
              key={v.name}
              className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-ivory-200 hover:border-plum-200 hover:shadow-card transition-all duration-200"
            >
              <div className="w-10 h-10 rounded-xl bg-ivory-100 flex items-center justify-center shrink-0">
                {v.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-charcoal">
                    {v.name}
                  </p>
                  {v.required && (
                    <Badge variant="gold" size="sm">
                      Key
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted">{v.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Timeline phases */}
      <div>
        <h3 className="text-sm font-semibold text-charcoal mb-3">
          Auto-Generated Timeline
        </h3>
        <div className="space-y-2">
          {timelinePhases.map((phase) => (
            <div
              key={phase.phase}
              className="flex items-start gap-3 p-3 rounded-xl bg-white border border-ivory-200"
            >
              <span
                className={`px-2 py-1 rounded-lg text-xs font-semibold whitespace-nowrap ${phase.color}`}
              >
                {phase.phase}
              </span>
              <div className="flex flex-wrap gap-2">
                {phase.tasks.map((task) => (
                  <span
                    key={task}
                    className="text-xs bg-ivory-100 text-charcoal-light px-2 py-1 rounded-lg"
                  >
                    {task}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-2 italic">
          Timeline is adjusted based on your event date:{' '}
          {formData.eventDate
            ? new Date(formData.eventDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })
            : 'not set'}
        </p>
      </div>
    </div>
  );
}
