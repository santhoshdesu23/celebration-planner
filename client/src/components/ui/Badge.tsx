import { cn } from '@/lib/utils';

type BadgeVariant = 'default' | 'plum' | 'gold' | 'success' | 'warning' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ivory-200 text-charcoal border border-ivory-300',
  plum: 'bg-plum-50 text-plum border border-plum-100',
  gold: 'bg-gold-50 text-gold-600 border border-gold-200',
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  info: 'bg-sky-50 text-sky-700 border border-sky-200',
};

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-charcoal',
  plum: 'bg-plum',
  gold: 'bg-gold',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  info: 'bg-sky-500',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs rounded-lg',
  md: 'px-2.5 py-1 text-xs rounded-xl',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className,
  dot = false,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {dot && (
        <span
          className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotColors[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
