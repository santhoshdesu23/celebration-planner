import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/lib/authContext';
import { api } from '@/lib/api';
import { hasGuestDraft, getGuestDraft, getGuestDraftId, clearGuestDraft } from '@/lib/guestDraft';
import { Button, Input, Card } from '@/components/ui';
import { Sparkles, Lock, Mail, AlertCircle } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const redirectParam = queryParams.get('redirect');
  const from = redirectParam || (location.state as { from?: string })?.from || '/events';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await login({ email, password });

      // Automatically save guest celebration draft to newly logged-in account
      if (hasGuestDraft()) {
        try {
          const draft = getGuestDraft();
          if (draft) {
            const draftId = getGuestDraftId() || draft.id;
            const saved = await api.saveGuestPlan({
              draftId,
              title: draft.title,
              type: draft.type,
              eventDate: draft.eventDate,
              guestCount: draft.guestCount,
              location: draft.location,
              description: draft.description,
              budget: draft.budget,
              timeline: draft.timeline,
              vendors: draft.vendors,
              ideas: draft.ideas,
            });
            clearGuestDraft();
            toast.success('🎉 Celebration plan saved to your account!');
            navigate(`/events/${saved.id}`, { replace: true });
            return;
          }
        } catch (saveErr) {
          console.error('Failed to auto-save guest draft:', saveErr);
          toast.error('Could not save guest plan automatically. Your draft is preserved.');
        }
      }

      navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed. Please check your credentials.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="section-container py-12 md:py-20 flex justify-center items-center min-h-[calc(100vh-16rem)]">
      <Card className="w-full max-w-md p-8 shadow-xl border-ivory-200">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-plum mx-auto flex items-center justify-center shadow-md mb-4">
            <Sparkles className="text-gold-300" size={24} />
          </div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-plum">
            Welcome Back
          </h1>
          <p className="text-sm text-charcoal-light mt-1">
            Sign in to access and manage your celebrations
          </p>
        </div>

        {hasGuestDraft() && (
          <div className="mb-6 p-4 rounded-xl bg-plum-50 border border-plum-100 flex items-center gap-3 text-plum text-xs">
            <Sparkles size={18} className="text-gold shrink-0" />
            <span>
              <strong>Celebration Draft Ready:</strong> Sign in now and we will automatically save your customized plan to your account!
            </span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl bg-crimson-50 border border-crimson-200 flex items-start gap-3 text-crimson text-sm"
          >
            <AlertCircle size={18} className="shrink-0 mt-0.5 text-crimson-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="login-email"
            type="email"
            label="Email Address"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            autoComplete="email"
            autoFocus
          />

          <Input
            id="login-password"
            type="password"
            label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            required
            autoComplete="current-password"
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            loading={isSubmitting}
            id="login-submit-btn"
          >
            Sign In
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-ivory-200 text-center text-sm text-charcoal-light">
          Don&apos;t have an account yet?{' '}
          <Link
            to="/register"
            state={{ from }}
            className="font-medium text-plum hover:text-gold transition-colors font-semibold underline underline-offset-4"
          >
            Create an account
          </Link>
        </div>
      </Card>
    </div>
  );
}
