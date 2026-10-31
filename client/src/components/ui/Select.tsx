import { forwardRef, useId, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  wrapperClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      error,
      hint,
      options,
      placeholder,
      wrapperClassName,
      className,
      id,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const selectId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : `select-${generatedId}`);
    const describedByIds = [
      error ? `${selectId}-error` : null,
      hint ? `${selectId}-hint` : null,
    ].filter(Boolean).join(' ') || undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', wrapperClassName)}>
        {label && (
          <label
            htmlFor={selectId}
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
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-required={required}
            aria-invalid={!!error}
            aria-describedby={describedByIds}
            className={cn(
              'w-full appearance-none rounded-xl border bg-white px-4 py-2.5 pr-10 text-sm text-charcoal',
              'transition-all duration-200 cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-plum-300 focus:border-plum',
              'disabled:bg-ivory-200 disabled:cursor-not-allowed disabled:text-muted',
              error
                ? 'border-red-300 focus:ring-red-300 focus:border-red-400'
                : 'border-ivory-300 hover:border-plum-200',
              className
            )}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          <div
            className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          >
            {error ? (
              <AlertCircle size={16} className="text-red-400" />
            ) : (
              <ChevronDown size={16} className="text-muted" />
            )}
          </div>
        </div>

        {error && (
          <p
            id={`${selectId}-error`}
            role="alert"
            className="text-xs text-red-600"
          >
            {error}
          </p>
        )}

        {hint && (
          <p id={`${selectId}-hint`} className="text-xs text-muted">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
