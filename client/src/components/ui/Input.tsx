import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      wrapperClassName,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-charcoal-light"
          >
            {label}
            {required && (
              <span className="ml-1 text-plum-400" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            >
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={!!error}
            aria-describedby={
              error
                ? `${inputId}-error`
                : hint
                  ? `${inputId}-hint`
                  : undefined
            }
            className={cn(
              'w-full rounded-xl border bg-white px-4 py-2.5 text-sm text-charcoal',
              'placeholder:text-muted transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-plum-300 focus:border-plum',
              'disabled:bg-ivory-200 disabled:cursor-not-allowed disabled:text-muted',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
                : 'border-ivory-300 hover:border-plum-200',
              className
            )}
            {...props}
          />

          {rightIcon && !error && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
              aria-hidden="true"
            >
              {rightIcon}
            </div>
          )}

          {error && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400"
              aria-hidden="true"
            >
              <AlertCircle size={16} />
            </div>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red-500 flex items-center gap-1"
          >
            {error}
          </p>
        )}

        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
