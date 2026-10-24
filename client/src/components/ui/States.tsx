import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'We ran into an unexpected error. Please try again.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center min-h-[40vh] gap-4 animate-fade-in text-center px-4"
    >
      <div className="w-16 h-16 rounded-full bg-plum-50 flex items-center justify-center">
        <AlertTriangle className="text-plum-400" size={28} />
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-charcoal mb-1">
          {title}
        </h2>
        <p className="text-muted text-sm max-w-sm">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw size={14} />}
        >
          Try again
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center px-4 animate-fade-in">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-ivory-200 flex items-center justify-center text-2xl">
          {icon}
        </div>
      )}
      <div>
        <h3 className="font-display text-lg font-semibold text-charcoal mb-1">
          {title}
        </h3>
        {description && (
          <p className="text-muted text-sm max-w-sm">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
