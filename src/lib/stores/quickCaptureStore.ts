import { writable } from 'svelte/store';

/**
 * Global open/close state for the Quick Capture modal. The modal can
 * be opened from anywhere — keyboard shortcut, command palette, empty
 * states — and optionally pre-seeded with text the user already had in
 * their clipboard or context (e.g. a paste handler that wants to file
 * something away as evidence in the background).
 */
export interface QuickCaptureContext {
  /** Pre-fill the paste field. */
  initialText?: string;
  /** Pre-pick a target so the hunter doesn't have to scroll. */
  targetId?: string;
  /** Pre-pick a session (when called from the timer). */
  sessionId?: string;
  /** Pre-link the new evidence to a specific note. */
  noteId?: string;
}

interface QuickCaptureState extends QuickCaptureContext {
  open: boolean;
}

function createStore() {
  const { subscribe, set } = writable<QuickCaptureState>({ open: false });

  return {
    subscribe,
    open(context: QuickCaptureContext = {}): void {
      set({ open: true, ...context });
    },
    close(): void {
      set({ open: false });
    }
  };
}

export const quickCaptureStore = createStore();
