export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
  secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 active:bg-gray-300',
  ghost: 'text-gray-700 hover:bg-gray-100 active:bg-gray-200',
  danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  outline: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 active:bg-gray-100',
};

// Minimum heights keep buttons aligned next to each other and next to inputs,
// while long labels can still wrap on narrow phones. `md` and `lg` meet the
// 44px minimum touch target.
const sizeClasses: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-11 px-4 py-2 text-sm',
  lg: 'min-h-12 px-6 py-2.5 text-base',
};

/**
 * The button look as a class string, for links that should look like buttons
 * (downloads, navigation, external pages) so they never drift from <Button>.
 */
export function buttonClasses({ variant = 'primary', size = 'md' }: { variant?: ButtonVariant; size?: ButtonSize } = {}) {
  return `inline-flex items-center justify-center gap-2 rounded-xl text-center font-medium transition-colors ${variantClasses[variant]} ${sizeClasses[size]}`;
}
