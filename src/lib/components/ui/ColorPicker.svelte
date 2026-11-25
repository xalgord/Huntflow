<script lang="ts" context="module">
  import type { AccentColor } from '$lib/types';

  export interface ColorPickerProps {
    value?: AccentColor;
  }

  /** Swatches mirror `accents` in tailwind.tokens.js (light / dark). */
  export const ACCENT_SWATCHES: Array<{ id: AccentColor; label: string; light: string; dark: string }> = [
    { id: 'crimson', label: 'Crimson', light: '#D70F3C', dark: '#E0244A' },
    { id: 'blue', label: 'Blue', light: '#0066CC', dark: '#0071E3' },
    { id: 'indigo', label: 'Indigo', light: '#5856D6', dark: '#5E5CE6' },
    { id: 'purple', label: 'Purple', light: '#9A48CF', dark: '#9A48CF' },
    { id: 'orange', label: 'Orange', light: '#B35F00', dark: '#B35F00' },
    { id: 'teal', label: 'Teal', light: '#007A91', dark: '#007A91' },
    { id: 'graphite', label: 'Graphite', light: '#636366', dark: '#6E6E73' }
  ];
</script>

<script lang="ts">
  import { Check } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let value: AccentColor = 'crimson';

  const dispatch = createEventDispatcher<{ change: AccentColor }>();

  $: selected = value === 'green' ? 'crimson' : value;
  $: selectedLabel = ACCENT_SWATCHES.find((swatch) => swatch.id === selected)?.label ?? 'Crimson';

  function select(id: AccentColor): void {
    value = id;
    dispatch('change', id);
  }
</script>

<div class="flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Accent color">
  {#each ACCENT_SWATCHES as swatch}
    <button
      type="button"
      role="radio"
      aria-checked={selected === swatch.id}
      aria-label={swatch.label}
      title={swatch.label}
      class="hf-accent-swatch relative flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110"
      style={`--swatch-light: ${swatch.light}; --swatch-dark: ${swatch.dark};`}
      on:click={() => select(swatch.id)}
    >
      {#if selected === swatch.id}
        <Check size={13} strokeWidth={3} class="text-white" aria-hidden="true" />
      {/if}
    </button>
  {/each}
  <span class="ml-1 text-xs text-zinc-500">{selectedLabel}</span>
</div>

<style>
  .hf-accent-swatch {
    background: var(--swatch-light);
    box-shadow:
      inset 0 0 0 0.5px rgb(0 0 0 / 0.18),
      0 1px 2px rgb(0 0 0 / 0.12);
  }

  :global(.dark) .hf-accent-swatch {
    background: var(--swatch-dark);
  }

  .hf-accent-swatch[aria-checked='true'] {
    outline: 2px solid var(--swatch-light);
    outline-offset: 2px;
  }

  :global(.dark) .hf-accent-swatch[aria-checked='true'] {
    outline-color: var(--swatch-dark);
  }
</style>
