import { useCallback, useEffect, useRef } from 'react';

/**
 * WCAG-conformant modal focus management.
 *
 * PHASE 0 — why this hook exists
 * ------------------------------
 * The two modals set initial focus and closed on Escape, but Tab escaped into
 * the page behind the overlay. The confirm dialog did the opposite: it called
 * `preventDefault()` on every Tab, so focus was pinned to a single button with
 * no keyboard route to the other one. Both are dialog failures.
 *
 * This hook does the three things a modal actually owes the user: move focus
 * in, cycle it inside, and put it back where it came from on close.
 */

const FOCUSABLE = [
'a[href]',
'button:not([disabled])',
'input:not([disabled]):not([type="hidden"])',
'select:not([disabled])',
'textarea:not([disabled])',
'summary',
'[tabindex]:not([tabindex="-1"])'].
join(',');

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el === document.activeElement
  );
}

export interface FocusTrapOptions {
  /** Set false to leave the page untouched (e.g. while the dialog is closed). */
  active?: boolean;
  /** Called on Escape. Omit to ignore Escape. */
  onEscape?: () => void;
  /** Element to focus when the trap activates. Defaults to the first focusable. */
  initialFocusRef?: React.RefObject<HTMLElement>;
}

/**
 * @returns A ref to attach to the dialog's outermost element.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
options: FocusTrapOptions = {})
: React.RefObject<T> {
  const { active = true, onEscape, initialFocusRef } = options;
  const containerRef = useRef<T>(null);
  const escapeRef = useRef(onEscape);
  escapeRef.current = onEscape;

  const cycle = useCallback((event: KeyboardEvent) => {
    const container = containerRef.current;
    if (!container) return;
    const items = focusableIn(container);
    if (items.length === 0) {
      event.preventDefault();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = document.activeElement as HTMLElement | null;

    if (!current || !container.contains(current)) {
      event.preventDefault();
      first.focus();
      return;
    }
    if (event.shiftKey && current === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const target =
    initialFocusRef?.current ?? (container ? focusableIn(container)[0] : null) ?? container;
    target?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (escapeRef.current) {
          event.preventDefault();
          escapeRef.current();
        }
        return;
      }
      if (event.key === 'Tab') cycle(event);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
    // `initialFocusRef` is a stable ref object; `cycle` is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cycle]);

  return containerRef;
}