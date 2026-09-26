/**
 * Keyboard-only shortcut past repeated navigation (WCAG 2.2 SC 2.4.1).
 * Visually hidden until focused.
 */
export function SkipLink({ targetId = 'main-content' }: { targetId?: string }) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-blue-700 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
    >
      Skip to main content
    </a>
  );
}
