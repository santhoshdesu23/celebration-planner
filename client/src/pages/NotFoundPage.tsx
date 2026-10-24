import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-[80vh] flex flex-col items-center justify-center text-center px-4 animate-fade-in"
      role="main"
      aria-label="Page not found"
    >
      <div className="text-8xl mb-6 animate-float" aria-hidden="true">
        🎈
      </div>
      <h1 className="font-display text-5xl font-bold text-charcoal mb-3">
        404
      </h1>
      <h2 className="font-display text-2xl font-semibold text-plum mb-3">
        Page Not Found
      </h2>
      <p className="text-muted text-sm max-w-sm mb-8">
        Looks like this page floated away. Let&apos;s get you back to planning
        your celebration.
      </p>
      <div className="flex gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => navigate(-1)}
          leftIcon={<ArrowLeft size={18} />}
        >
          Go Back
        </Button>
        <Button
          id="404-plan-cta"
          variant="primary"
          size="lg"
          onClick={() => navigate('/')}
          leftIcon={<Sparkles size={18} />}
        >
          Plan an Event
        </Button>
      </div>
    </div>
  );
}
