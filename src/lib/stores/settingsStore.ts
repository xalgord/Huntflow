import { browser } from '$app/environment';
import { settingsDB } from '$lib/db/settings';
import { DEFAULT_SETTINGS, type Settings } from '$lib/types';
import { writable, type Readable } from 'svelte/store';

interface SettingsStore extends Readable<Settings> {
  load(): Promise<Settings>;
  refresh(): Promise<Settings>;
  set(settings: Settings): Promise<void>;
  update(updater: (settings: Settings) => Settings): Promise<void>;
  reset(): Promise<void>;
  setValue<K extends keyof Settings>(key: K, value: Settings[K]): Promise<void>;
  setTheme(theme: Settings['theme']): Promise<void>;
  persistNow(): Promise<void>;
}

const source = writable<Settings>(DEFAULT_SETTINGS);
let value = DEFAULT_SETTINGS;
let loaded = false;
let loading: Promise<Settings> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let mediaQueryListenerInstalled = false;

source.subscribe((settings) => {
  value = settings;
});

function resolveTheme(theme: Settings['theme']): boolean {
  if (!browser) return theme !== 'light';
  return (
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );
}

function applyTheme(theme: Settings['theme']): void {
  if (!browser) return;
  const dark = resolveTheme(theme);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
  const meta = document.querySelector('meta[name="theme-color"]:not([media])');
  meta?.setAttribute('content', dark ? '#050507' : '#f1f2f7');
}

/** Normalise legacy values written by earlier versions. */
export function normalizeSettings(settings: Settings): Settings {
  if (settings.accentColor === 'green') return { ...settings, accentColor: 'crimson' };
  return settings;
}

/**
 * Key used by the inline boot script in app.html to paint the right
 * appearance before the app hydrates (IndexedDB is async, so without this
 * light-mode users would see a dark flash on every load).
 */
export const APPEARANCE_CACHE_KEY = 'huntflow-appearance';

function applyAppearance(settings: Settings): void {
  if (!browser) return;
  applyTheme(settings.theme);

  const accent = settings.accentColor === 'green' ? 'crimson' : settings.accentColor;
  document.documentElement.dataset.accent = accent;
  document.documentElement.dataset.fontSize = settings.fontSize;
  const transparency = settings.reduceTransparency ? 'reduced' : 'glass';
  document.documentElement.dataset.transparency = transparency;
  try {
    localStorage.setItem(
      APPEARANCE_CACHE_KEY,
      JSON.stringify({ theme: settings.theme, accent, fontSize: settings.fontSize, transparency })
    );
  } catch {
    /* storage disabled — the boot script falls back to system appearance */
  }
}

async function flush(): Promise<void> {
  if (!browser || !loaded) return;

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  await settingsDB.putSettings(value);
}

let failedAttempts = 0;

function scheduleSave(delay = 500): void {
  if (!browser || !loaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flush()
      .then(() => {
        failedAttempts = 0;
      })
      .catch((error) => {
        failedAttempts += 1;
        console.warn('[settingsStore] save failed, retrying:', error);
        scheduleSave(Math.min(30_000, 1_000 * 2 ** Math.min(failedAttempts, 5)));
      });
  }, delay);
}

async function load(): Promise<Settings> {
  if (!browser) return value;
  if (loaded) return value;
  if (loading) return loading;

  loading = settingsDB.getSettings().then((stored) => {
    const settings = normalizeSettings(stored);
    loaded = true;
    source.set(settings);
    applyAppearance(settings);
    return settings;
  });

  try {
    return await loading;
  } finally {
    loading = null;
  }
}

async function refresh(): Promise<Settings> {
  loaded = false;
  return load();
}

async function setSettings(settings: Settings): Promise<void> {
  await load();
  source.set(settings);
  applyAppearance(settings);
  scheduleSave();
}

async function updateSettings(updater: (settings: Settings) => Settings): Promise<void> {
  await load();
  const next = updater(value);
  source.set(next);
  applyAppearance(next);
  scheduleSave();
}

export const settingsStore: SettingsStore = {
  subscribe(run, invalidate) {
    void load();
    return source.subscribe(run, invalidate);
  },
  load,
  refresh,
  set: setSettings,
  update: updateSettings,
  async reset() {
    await setSettings(DEFAULT_SETTINGS);
  },
  async setValue(key, nextValue) {
    await updateSettings((settings) => ({ ...settings, [key]: nextValue }));
  },
  async setTheme(theme) {
    await updateSettings((settings) => ({ ...settings, theme }));
  },
  persistNow: flush
};

if (browser && !mediaQueryListenerInstalled) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (value.theme === 'system') applyTheme(value.theme);
  });
  mediaQueryListenerInstalled = true;
  // NOTE: settings flushing on pagehide is handled centrally by
  // `flushAllStores()` in +layout.svelte. We deliberately don't add a
  // second pagehide listener here — having two listeners racing the
  // same write is harmless but wastes a microtask in the unload path,
  // and it makes the cleanup story confusing for anyone reading this
  // file in isolation.
}
