import { goto } from '$app/navigation';
import { writable } from 'svelte/store';

/**
 * Global keyboard shortcut registry.
 *
 * Two flavours of shortcuts:
 *  - **Single keys** like `?` to show help, `c` to create-in-context.
 *  - **Two-key sequences** like `g d` (go to Dashboard), GitHub-style.
 *    The first key arms a 1.2s timer; if a matching second key arrives
 *    within the window the action fires, otherwise the buffer resets.
 *
 * The handler is automatically suppressed when the user is typing inside
 * an input/textarea/select/contenteditable so it never intercepts text
 * entry.
 */

export interface NavShortcut {
  /** Human-readable category for the cheatsheet. */
  group: 'Navigation' | 'Actions' | 'Help';
  /** Tokens that the cheatsheet renders as <kbd> chips, e.g. ['g', 'd']. */
  keys: string[];
  /** Display name in the help dialog. */
  label: string;
  /** Optional sub-text shown in muted color. */
  hint?: string;
}

interface NavTarget extends NavShortcut {
  group: 'Navigation';
  /** First key in the sequence (always lowercase, no modifiers). */
  prefix: 'g';
  /** Second key — single character, lowercase. */
  trigger: string;
  /** Path to navigate to. */
  href: string;
}

/**
 * The canonical list. Anything added here automatically appears in the
 * cheatsheet UI and is wired into the global handler.
 */
export const navTargets: NavTarget[] = [
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'd',
    keys: ['g', 'd'],
    label: 'Dashboard',
    href: '/dashboard'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 't',
    keys: ['g', 't'],
    label: 'Timer',
    href: '/timer'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'r',
    keys: ['g', 'r'],
    label: 'Targets',
    href: '/targets',
    hint: 'r for "rooms"'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'p',
    keys: ['g', 'p'],
    label: 'Payloads',
    href: '/payloads'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'n',
    keys: ['g', 'n'],
    label: 'Notes',
    href: '/notes'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 's',
    keys: ['g', 's'],
    label: 'Submissions',
    href: '/submissions'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'v',
    keys: ['g', 'v'],
    label: 'Evidence',
    href: '/assets',
    hint: 'v for "view evidence"'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'b',
    keys: ['g', 'b'],
    label: 'References',
    href: '/bookmarks'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: 'k',
    keys: ['g', 'k'],
    label: 'Toolkit',
    href: '/tools'
  },
  {
    group: 'Navigation',
    prefix: 'g',
    trigger: ',',
    keys: ['g', ','],
    label: 'Settings',
    href: '/settings'
  }
];

/**
 * Route-aware "create" mappings for the `c` shortcut. Each entry returns
 * the URL or no-op based on the current pathname.
 */
const createRoutes: Array<{ match: (path: string) => boolean; href: string }> = [
  { match: (p) => p.startsWith('/targets') && p === '/targets', href: '/targets?new=1' },
  { match: (p) => p.startsWith('/notes') && p === '/notes', href: '/notes?new=1' },
  { match: (p) => p.startsWith('/payloads'), href: '/payloads?new=1' },
  { match: (p) => p.startsWith('/submissions'), href: '/submissions?new=1' },
  { match: (p) => p.startsWith('/bookmarks'), href: '/bookmarks?new=1' },
  // Default: jump to the timer page so `c` always means "start hunting".
  { match: () => true, href: '/timer' }
];

/** Cheatsheet rows that are not navigation but still listed for reference. */
export const utilityShortcuts: NavShortcut[] = [
  { group: 'Actions', keys: ['⌘', '⇧', 'K'], label: 'Quick Capture', hint: 'paste a request, JWT, URL, or screenshot — auto-classified' },
  { group: 'Actions', keys: ['c'], label: 'Create in context', hint: 'opens the new-item form for this page' },
  { group: 'Actions', keys: ['Esc'], label: 'Close dialog or palette' },
  { group: 'Help', keys: ['/'], label: 'Open command palette' },
  { group: 'Help', keys: ['⌘', 'K'], label: 'Open command palette' },
  { group: 'Help', keys: ['?'], label: 'Show this cheatsheet' }
];

/** Open/close the cheatsheet modal from anywhere. */
export const shortcutsHelpStore = writable(false);

function isTextInput(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

let prefixArmedAt = 0;
const PREFIX_WINDOW_MS = 1200;
let prefix: 'g' | null = null;

function clearPrefix() {
  prefix = null;
  prefixArmedAt = 0;
}

/**
 * Install the global handler. Returns a cleanup function so the layout
 * can call it during teardown — though in practice the layout lives for
 * the entire app session, so this is mostly defensive.
 */
export function installGlobalShortcuts(getPathname: () => string): () => void {
  const onKeyDown = (event: KeyboardEvent) => {
    // Ignore anything with modifiers (handled elsewhere — Cmd+K, etc.).
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTextInput(event.target)) return;

    const key = event.key;

    // `?` opens the cheatsheet (Shift + `/` on US layouts produces `?`).
    if (key === '?') {
      event.preventDefault();
      shortcutsHelpStore.set(true);
      return;
    }

    // If a prefix is armed and still inside the window, look for a match.
    // If the window has expired, drop the stale prefix and let the current
    // key fall through to single-key handling below.
    if (prefix === 'g') {
      if (Date.now() - prefixArmedAt <= PREFIX_WINDOW_MS) {
        const target = navTargets.find((nav) => nav.trigger === key.toLowerCase());
        if (target) {
          event.preventDefault();
          clearPrefix();
          void goto(target.href);
          return;
        }
      }
      // Either the window expired or the second key wasn't a registered
      // trigger. Clear the buffer and continue evaluating the current key
      // as a normal single-key shortcut.
      clearPrefix();
    }

    // Arm the `g` prefix.
    if (key === 'g') {
      prefix = 'g';
      prefixArmedAt = Date.now();
      return;
    }

    // Single-key shortcuts.
    if (key === 'c') {
      const path = getPathname();
      const route = createRoutes.find((entry) => entry.match(path));
      if (!route) return;
      event.preventDefault();
      void goto(route.href);
      return;
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}
