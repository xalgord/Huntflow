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
  document.documentElement.classList.toggle('dark', resolveTheme(theme));
  document.documentElement.classList.toggle('light', !resolveTheme(theme));
}

const accentPalettes: Record<Settings['accentColor'], { accent: string; hover: string; link: string }> = {
  green: { accent: '#fafafa', hover: '#ffffff', link: '#e4e4e7' },
  blue: { accent: '#3b82f6', hover: '#2563eb', link: '#60a5fa' },
  orange: { accent: '#f97316', hover: '#ea580c', link: '#fb923c' },
  purple: { accent: '#8b5cf6', hover: '#7c3aed', link: '#a78bfa' }
};

function applyAppearance(settings: Settings): void {
  if (!browser) return;
  applyTheme(settings.theme);

  const palette = accentPalettes[settings.accentColor];
  document.documentElement.style.setProperty('--color-accent', palette.accent);
  document.documentElement.style.setProperty('--color-accent-hover', palette.hover);
  document.documentElement.style.setProperty('--color-link', palette.link);
  document.documentElement.dataset.accent = settings.accentColor;
  document.documentElement.dataset.fontSize = settings.fontSize;
}

async function flush(): Promise<void> {
  if (!browser || !loaded) return;

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  await settingsDB.putSettings(value);
}

function scheduleSave(): void {
  if (!browser || !loaded) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void flush();
  }, 500);
}

async function load(): Promise<Settings> {
  if (!browser) return value;
  if (loaded) return value;
  if (loading) return loading;

    loading = settingsDB.getSettings().then((settings) => {
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
