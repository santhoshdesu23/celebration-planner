import React from 'react';
import {
  Sparkles,
  Calendar,
  Users,
  DollarSign,
  CheckSquare,
  Star,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';

export const eventCategories = [
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

export const features = [
  {
    icon: React.createElement(Sparkles, { className: 'text-gold', size: 24 }),
    title: 'AI Planning Assistant',
    description:
      'Powered by Gemini AI, our assistant generates personalised themes, vendor suggestions, and timeline recommendations tailored to your event.',
    badge: 'AI-Powered',
    badgeVariant: 'gold' as const,
  },
  {
    icon: React.createElement(DollarSign, { className: 'text-plum', size: 24 }),
    title: 'Smart Budget Tracker',
    description:
      'Set your budget, track every penny across categories, and get real-time alerts when you approach limits — no spreadsheets needed.',
    badge: 'Real-time',
    badgeVariant: 'plum' as const,
  },
  {
    icon: React.createElement(Calendar, { className: 'text-emerald-600', size: 24 }),
    title: 'Dynamic Timeline',
    description:
      'Auto-generated milestones count down to your big day. Customise tasks, set reminders, and never miss a critical deadline.',
    badge: 'Auto-generated',
    badgeVariant: 'success' as const,
  },
  {
    icon: React.createElement(CheckSquare, { className: 'text-sky-600', size: 24 }),
    title: 'Vendor Checklist',
    description:
      'Manage caterers, photographers, florists, and more from one dashboard. Track quotes, bookings, and communications in one place.',
    badge: 'Organised',
    badgeVariant: 'info' as const,
  },
  {
    icon: React.createElement(Users, { className: 'text-plum-400', size: 24 }),
    title: 'Guest Management',
    description:
      'Track RSVPs, dietary preferences, and seating arrangements with an intuitive guest list manager.',
    badge: 'Coming soon',
    badgeVariant: 'default' as const,
  },
  {
    icon: React.createElement(Star, { className: 'text-gold-400', size: 24 }),
    title: 'Personalised Ideas',
    description:
      'Receive curated theme ideas, décor inspiration, and entertainment suggestions that match your vision and budget.',
    badge: 'AI-Curated',
    badgeVariant: 'gold' as const,
  },
];

export const stats = [
  { value: '15k+', label: 'Events Planned' },
  { value: '98%', label: 'Happy Planners' },
  { value: '200+', label: 'Vendor Partners' },
  { value: '4.9★', label: 'Average Rating' },
];

export const trustPoints = [
  { icon: React.createElement(Zap, { size: 18 }), text: 'Setup in under 2 minutes' },
  { icon: React.createElement(Shield, { size: 18 }), text: 'Your data stays private' },
  { icon: React.createElement(Clock, { size: 18 }), text: 'Save 20+ hours of planning' },
];

export const testimonials = [
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

