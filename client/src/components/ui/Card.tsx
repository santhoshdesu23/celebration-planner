import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'elevated' | 'bordered';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverable?: boolean;
}

const variantClasses = {
  default: 'bg-white rounded-3xl shadow-card',
  glass: 'glass-card',
  elevated: 'bg-white rounded-3xl shadow-card-hover',
  bordered: 'bg-white rounded-3xl border-2 border-ivory-200',
};

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export function Card({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  children,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'transition-all duration-300',
        variantClasses[variant],
        paddingClasses[padding],
        hoverable && 'hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-xl font-semibold text-charcoal', className)}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('text-muted text-sm leading-relaxed', className)} {...props}>
      {children}
    </p>
  );
}

export function CardFooter({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 pt-4 border-t border-ivory-200 flex items-center', className)}
      {...props}
    >
      {children}
    </div>
  );
}
