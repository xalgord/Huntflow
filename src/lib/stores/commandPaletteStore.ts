import { writable } from 'svelte/store';

/**
 * Tiny global open/close state for the Command Palette so any component
 * (sidebar button, mobile header, keyboard shortcut, empty-state CTA, etc.)
 * can pop it open without prop drilling through the layout tree.
 */
function createPaletteStore() {
  const { subscribe, set, update } = writable<{ open: boolean; initialQuery: string }>({
    open: false,
    initialQuery: ''
  });

  return {
    subscribe,
    open(initialQuery = ''): void {
      set({ open: true, initialQuery });
    },
    close(): void {
      set({ open: false, initialQuery: '' });
    },
    toggle(): void {
      update((state) => ({ open: !state.open, initialQuery: '' }));
    }
  };
}

export const commandPaletteStore = createPaletteStore();
