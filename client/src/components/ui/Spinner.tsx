import { cn } from '@/lib/utils';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4 border-2',
  md: 'w-8 h-8 border-2',
  lg: 'w-12 h-12 border-3',
};

export function Spinner({ size = 'md', className, label = 'Loading…' }: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center justify-center', className)}
    >
      <div
        aria-hidden="true"
        className={cn(
          'rounded-full border-plum-100 border-t-plum animate-spin',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

interface LoadingPageProps {
  message?: string;
}

export function LoadingPage({ message = 'Loading your celebration…' }: LoadingPageProps) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-fade-in"
    >
      {/* Decorative rings */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 rounded-full border-4 border-plum-100 animate-ping opacity-25" />
        <div className="absolute inset-2 rounded-full border-4 border-t-plum border-ivory-200 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl" role="img" aria-label="celebration">
            🎉
          </span>
        </div>
      </div>
      <p className="text-muted text-sm font-medium animate-pulse">{message}</p>
    </div>
  );
}
