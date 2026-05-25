<script lang="ts" context="module">
  import type { Settings } from '$lib/types';

  export interface ColorPickerProps {
    value?: Settings['accentColor'];
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value: Settings['accentColor'] = 'green';

  const dispatch = createEventDispatcher<{ change: Settings['accentColor'] }>();
  const colors: Array<{ id: Settings['accentColor']; label: string; className: string }> = [
    { id: 'green', label: 'Green', className: 'bg-primary-500' },
    { id: 'blue', label: 'Blue', className: 'bg-blue-500' },
    { id: 'orange', label: 'Orange', className: 'bg-orange-500' },
    { id: 'purple', label: 'Purple', className: 'bg-violet-500' }
  ];

  function select(id: Settings['accentColor']): void {
    value = id;
    dispatch('change', id);
  }
</script>

<div class="space-y-2">
  <p class="hf-label">Accent color</p>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {#each colors as color}
      <button
        type="button"
        class="flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-medium transition {value === color.id
          ? 'border-primary-500 bg-zinc-750 text-zinc-100'
          : 'border-zinc-600 bg-zinc-850 text-zinc-300 hover:bg-zinc-800'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
        aria-pressed={value === color.id}
        on:click={() => select(color.id)}
      >
        <span class="h-4 w-4 rounded-full {color.className}"></span>
        {color.label}
      </button>
    {/each}
  </div>
</div>
