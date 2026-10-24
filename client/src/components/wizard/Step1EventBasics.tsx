import { Calendar, MapPin, Users, FileText } from 'lucide-react';
import { Input, Select } from '@/components/ui';
import type { WizardFormData } from '@/hooks/useEventWizard';
import type { EventType } from '@celebration-planner/shared';

interface Step1Props {
  formData: WizardFormData;
  errors: Partial<Record<keyof WizardFormData, string>>;
  updateField: <K extends keyof WizardFormData>(field: K, value: WizardFormData[K]) => void;
}

const eventTypeOptions = [
  { value: 'wedding', label: '💍 Wedding' },
  { value: 'birthday', label: '🎂 Birthday' },
  { value: 'anniversary', label: '✨ Anniversary' },
  { value: 'corporate', label: '🏢 Corporate' },
  { value: 'community', label: '🌿 Community Event' },
  { value: 'graduation', label: '🎓 Graduation' },
  { value: 'baby_shower', label: '🍼 Baby Shower' },
  { value: 'other', label: '🎉 Other' },
];

// Build min date string as today
function getTodayString(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function Step1EventBasics({ formData, errors, updateField }: Step1Props) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="font-display text-2xl font-bold text-charcoal mb-1">
          Tell Us About Your Event
        </h2>
        <p className="text-muted text-sm">
          Start with the basics and we&apos;ll build the rest.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Input
          id="event-title"
          label="Event Name"
          placeholder="e.g. Sarah & Tom's Wedding"
          value={formData.title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('title', e.target.value)}
          error={errors.title}
          required
          maxLength={200}
          wrapperClassName="sm:col-span-2"
        />

        <Select
          id="event-type"
          label="Event Type"
          placeholder="Select event type"
          options={eventTypeOptions}
          value={formData.type}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateField('type', e.target.value as EventType)}
          error={errors.type}
          required
        />

        <Input
          id="event-date"
          label="Event Date"
          type="date"
          min={getTodayString()}
          value={formData.eventDate}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('eventDate', e.target.value)}
          error={errors.eventDate}
          required
          leftIcon={<Calendar size={16} />}
        />

        <Input
          id="event-location"
          label="Location / Venue"
          placeholder="e.g. Grand Ballroom, New York"
          value={formData.location}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('location', e.target.value)}
          error={errors.location}
          required
          leftIcon={<MapPin size={16} />}
          wrapperClassName="sm:col-span-2"
        />

        <Input
          id="event-guest-count"
          label="Expected Guests"
          type="number"
          min={1}
          max={100000}
          placeholder="e.g. 150"
          value={formData.guestCount}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('guestCount', e.target.value)}
          error={errors.guestCount}
          required
          leftIcon={<Users size={16} />}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="event-description"
          className="text-sm font-medium text-charcoal-light"
        >
          Event Vision{' '}
          <span className="text-muted font-normal">(optional)</span>
        </label>
        <div className="relative">
          <FileText
            size={16}
            className="absolute left-3 top-3 text-muted pointer-events-none"
          />
          <textarea
            id="event-description"
            rows={3}
            placeholder="Share your vision, theme ideas, or special requirements…"
            value={formData.description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => updateField('description', e.target.value)}
            maxLength={2000}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-ivory-300 bg-white text-sm text-charcoal placeholder:text-muted resize-none focus:outline-none focus:ring-2 focus:ring-plum-300 focus:border-plum transition-all duration-200 hover:border-plum-200"
          />
        </div>
        <p className="text-xs text-muted text-right">
          {formData.description.length}/2000
        </p>
      </div>
    </div>
  );
}
