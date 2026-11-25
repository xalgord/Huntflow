<script lang="ts">
  import { settingsStore } from '$lib/stores';
  import type { Settings } from '$lib/types';
  import ColorPicker from '$lib/components/ui/ColorPicker.svelte';

  export let settings: Settings;

  const themes: Array<{ id: Settings['theme']; label: string }> = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'Auto' }
  ];

  const fontSizes: Array<{ id: Settings['fontSize']; label: string }> = [
    { id: 'small', label: 'Small' },
    { id: 'medium', label: 'Default' },
    { id: 'large', label: 'Large' }
  ];
</script>

<section class="hf-card overflow-hidden" aria-labelledby="appearance-heading">
  <div class="px-4 pb-1 pt-4">
    <h2 id="appearance-heading" class="hf-section-title">Appearance</h2>
    <p class="mt-0.5 text-xs text-zinc-500">Auto follows your system's light and dark setting.</p>
  </div>

  <div class="flex flex-wrap gap-5 px-4 py-4" role="radiogroup" aria-label="Theme">
    {#each themes as theme}
      {@const active = settings.theme === theme.id}
      <button
        type="button"
        role="radio"
        aria-checked={active}
        class="group flex flex-col items-center gap-2 text-xs font-medium {active ? 'text-zinc-50' : 'text-zinc-400'}"
        on:click={() => settingsStore.setTheme(theme.id)}
      >
        <span
          class="hf-theme-thumb hf-theme-thumb--{theme.id} relative block h-[54px] w-[84px] overflow-hidden rounded-[8px] transition {active
            ? 'ring-[2.5px] ring-primary ring-offset-2 ring-offset-[var(--hf-surface)]'
            : 'group-hover:opacity-90'}"
          aria-hidden="true"
        >
          <span class="hf-theme-thumb__sidebar"></span>
          <span class="hf-theme-thumb__window">
            <span class="hf-theme-thumb__bar"></span>
            <span class="hf-theme-thumb__accent"></span>
          </span>
        </span>
        {theme.label}
      </button>
    {/each}
  </div>

  <div class="hf-list border-t border-zinc-900">
    <div class="hf-list-row flex-wrap justify-between gap-y-2">
      <span class="text-zinc-100">Accent color</span>
      <ColorPicker
        value={settings.accentColor}
        on:change={(event) => settingsStore.setValue('accentColor', event.detail)}
      />
    </div>
    <div class="hf-list-row justify-between">
      <span class="text-zinc-100">Text size</span>
      <div class="hf-segmented" role="radiogroup" aria-label="Text size">
        {#each fontSizes as size}
          <button
            type="button"
            role="radio"
            aria-checked={settings.fontSize === size.id}
            class="hf-segment {settings.fontSize === size.id ? 'hf-segment-active' : ''}"
            on:click={() => settingsStore.setValue('fontSize', size.id)}
          >
            {size.label}
          </button>
        {/each}
      </div>
    </div>
  </div>
</section>

<style>
  .hf-theme-thumb {
    box-shadow: 0 0 0 0.5px rgb(0 0 0 / 0.2);
  }

  .hf-theme-thumb__sidebar {
    position: absolute;
    inset: 0 auto 0 0;
    width: 26px;
  }

  .hf-theme-thumb__window {
    position: absolute;
    inset: 8px 8px 0 34px;
    border-radius: 4px 4px 0 0;
  }

  .hf-theme-thumb__bar {
    position: absolute;
    left: 6px;
    right: 14px;
    top: 7px;
    height: 4px;
    border-radius: 2px;
  }

  .hf-theme-thumb__accent {
    position: absolute;
    left: 6px;
    top: 16px;
    width: 18px;
    height: 6px;
    border-radius: 3px;
    background: hsl(var(--primary));
  }

  .hf-theme-thumb--light {
    background: #e9e9ee;
  }
  .hf-theme-thumb--light .hf-theme-thumb__sidebar {
    background: #dcdce2;
  }
  .hf-theme-thumb--light .hf-theme-thumb__window {
    background: #ffffff;
  }
  .hf-theme-thumb--light .hf-theme-thumb__bar {
    background: #d1d1d6;
  }

  .hf-theme-thumb--dark {
    background: #000000;
  }
  .hf-theme-thumb--dark .hf-theme-thumb__sidebar {
    background: #1c1c1e;
  }
  .hf-theme-thumb--dark .hf-theme-thumb__window {
    background: #2c2c2e;
  }
  .hf-theme-thumb--dark .hf-theme-thumb__bar {
    background: #48484a;
  }

  .hf-theme-thumb--system {
    background: linear-gradient(135deg, #e9e9ee 50%, #000000 50%);
  }
  .hf-theme-thumb--system .hf-theme-thumb__sidebar {
    background: linear-gradient(135deg, #dcdce2 50%, #1c1c1e 50%);
  }
  .hf-theme-thumb--system .hf-theme-thumb__window {
    background: linear-gradient(135deg, #ffffff 50%, #2c2c2e 50%);
  }
  .hf-theme-thumb--system .hf-theme-thumb__bar {
    background: linear-gradient(135deg, #d1d1d6 50%, #48484a 50%);
  }
</style>
