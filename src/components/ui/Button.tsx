import { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Spinner } from './Spinner';
import { buttonClasses, type ButtonSize, type ButtonVariant } from './button-styles';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  // Defaults to "button" so a button inside a form never submits it by
  // accident. Submit buttons must say type="submit".
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${buttonClasses({ variant, size })} disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}
