import { type ReactNode, useId } from 'react';

interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  /** Shown when the user tries to continue without ticking. */
  error?: string | null;
}

/**
 * An explicit, unticked-by-default consent control.
 *
 * Section 6(1) of the Digital Personal Data Protection Act, 2023 requires
 * consent to be free, specific, informed, unconditional, and given by a clear
 * affirmative action. A pre-ticked box is not a clear affirmative action, and
 * the Central Consumer Protection Authority's 2023 dark-pattern guidelines
 * treat pre-selection as a dark pattern — so this component never defaults to
 * checked, and the caller must not pass `checked` as true initially.
 *
 * The whole control is one label, so tapping the text toggles it, and the
 * native checkbox keeps full keyboard support (Tab to reach, Space to toggle).
 */
export function ConsentCheckbox({ checked, onChange, children, error }: ConsentCheckboxProps) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label
        htmlFor={id}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
          error
            ? 'border-red-400 bg-red-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 flex-shrink-0 cursor-pointer rounded border-gray-400 text-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        />
        <span className="text-sm leading-relaxed text-gray-700">{children}</span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
