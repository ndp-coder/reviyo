/**
 * Copies text and reports whether it worked. Falls back to the older
 * selection-based copy where the Clipboard API is missing or refused, which is
 * common in the in-app browsers that QR scanner apps open links in. Call it
 * straight from the tap: browsers only allow copying during a user action.
 */
export async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Refused (permissions, an embedded browser): try the older way.
    }
  }
  return copyWithSelection(text);
}

function copyWithSelection(text: string): boolean {
  const previousFocus = document.activeElement as HTMLElement | null;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  // Read-only and off-screen, so phones don't open the keyboard or scroll.
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  textarea.setSelectionRange(0, text.length); // iOS ignores select() alone
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(textarea);
  previousFocus?.focus?.();
  return copied;
}
