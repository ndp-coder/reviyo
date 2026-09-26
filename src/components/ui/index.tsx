import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, Eye, EyeOff, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
export { Button } from './Button';
export { Spinner } from './Spinner';

// One field style for the whole app: 44px tall, a border dark enough to see on
// white, and a blue focus ring. Errors turn the border red and are announced.
const fieldBase =
  'w-full rounded-xl border bg-white text-sm text-gray-900 placeholder:text-gray-500 outline-none transition-colors disabled:bg-gray-50 disabled:text-gray-500';
const fieldState = (error?: string) =>
  error
    ? 'border-red-500 focus:border-red-600 focus:ring-2 focus:ring-red-100'
    : 'border-gray-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** Short helper text under the field, linked with aria-describedby. */
  hint?: ReactNode;
  /** Decorative icon shown inside the field on the left. */
  icon?: LucideIcon;
  /** For password fields: adds a show/hide button so people can check what they typed. */
  revealable?: boolean;
}

export function Input({
  label,
  error,
  hint,
  icon: Icon,
  revealable = false,
  className = '',
  id,
  type,
  'aria-describedby': ariaDescribedBy,
  ...props
}: InputProps) {
  const [revealed, setRevealed] = useState(false);
  const canReveal = revealable && type === 'password';
  const generatedId = useId();
  const inputId = id ?? `input-${generatedId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-gray-800">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            aria-hidden
          />
        )}
        <input
          {...props}
          type={canReveal && revealed ? 'text' : type}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`${fieldBase} ${fieldState(error)} h-11 ${Icon ? 'pl-10' : 'pl-4'} ${canReveal ? 'pr-12' : 'pr-4'} ${className}`}
        />
        {canReveal && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            aria-pressed={revealed}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          >
            {revealed ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
}

export function Textarea({
  label,
  error,
  hint,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  ...props
}: TextareaProps) {
  const generatedId = useId();
  const textareaId = id ?? `textarea-${generatedId}`;
  const errorId = error ? `${textareaId}-error` : undefined;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const describedBy = [ariaDescribedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="mb-1.5 block text-sm font-medium text-gray-800">
          {label}
        </label>
      )}
      <textarea
        {...props}
        id={textareaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${fieldBase} ${fieldState(error)} resize-y px-4 py-2.5 ${className}`}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-gray-600">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: ReactNode;
}

/** Native select with the same size, border, and focus ring as Input. */
export function Select({ label, hint, className = '', id, children, ...props }: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? `select-${generatedId}`;
  const hintId = hint ? `${selectId}-hint` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="mb-1.5 block text-sm font-medium text-gray-800">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...props}
          id={selectId}
          aria-describedby={hintId}
          className={`${fieldBase} ${fieldState()} h-11 appearance-none pl-4 pr-10 ${className}`}
        >
          {children}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600"
          aria-hidden="true"
        />
      </div>
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-gray-600">
          {hint}
        </p>
      )}
    </div>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: an icon-only button has no other accessible name. */
  'aria-label': string;
  tone?: 'default' | 'danger';
  children: ReactNode;
}

/** Square icon-only button with a 36px target — large enough to tap reliably in dense rows. */
export function IconButton({ tone = 'default', className = '', type = 'button', children, ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-gray-600 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === 'danger' ? 'hover:bg-red-50 hover:text-red-700' : 'hover:bg-gray-100 hover:text-gray-900'
      } ${className}`}
    >
      {children}
    </button>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
}

/** Plain bordered surface. No shadow: borders alone keep dense dashboards calm. */
export function Card({ children, className = '' }: CardProps) {
  return <div className={`rounded-2xl border border-gray-200 bg-white ${className}`}>{children}</div>;
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
}

export function Badge({ children, variant = 'default' }: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-amber-100 text-amber-900',
    error: 'bg-red-100 text-red-800',
    info: 'bg-blue-100 text-blue-800',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

type AlertVariant = 'error' | 'success' | 'warning' | 'info';

const alertStyles: Record<AlertVariant, { box: string; icon: typeof Info }> = {
  error: { box: 'border-red-300 bg-red-50 text-red-900', icon: AlertCircle },
  success: { box: 'border-green-300 bg-green-50 text-green-900', icon: CheckCircle2 },
  warning: { box: 'border-amber-300 bg-amber-50 text-amber-950', icon: TriangleAlert },
  info: { box: 'border-blue-200 bg-blue-50 text-blue-950', icon: Info },
};

/**
 * Inline message for the result of an action. Errors are announced
 * immediately (role="alert"); everything else politely (role="status").
 */
export function Alert({
  variant = 'info',
  title,
  children,
  action,
  className = '',
}: {
  variant?: AlertVariant;
  title?: ReactNode;
  children?: ReactNode;
  /** A recovery control, such as a "Try again" button, shown after the message. */
  action?: ReactNode;
  className?: string;
}) {
  const { box, icon: Icon } = alertStyles[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${box} ${className}`}
    >
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/** Title block at the top of every dashboard page. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="font-semiwide text-2xl font-bold tracking-[-0.01em] text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-gray-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      {icon && (
        <div aria-hidden="true" className="mb-3 text-gray-400">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-gray-800">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-lg bg-gray-200 ${className}`} />;
}
