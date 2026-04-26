<script lang="ts" context="module">
  export interface ToggleProps {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    description?: string;
  }
</script>

<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let checked = false;
  export let disabled = false;
  export let label = '';
  export let description = '';

  const dispatch = createEventDispatcher<{ change: boolean }>();

  function toggle(): void {
    if (disabled) return;
    checked = !checked;
    dispatch('change', checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-md border border-slate-700 bg-slate-850 px-3 py-2.5 text-left transition hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 disabled:cursor-not-allowed disabled:opacity-60"
  on:click={toggle}
>
  <span>
    <span class="block text-sm font-medium text-slate-100">{label}</span>
    {#if description}
      <span class="mt-1 block text-xs leading-5 text-slate-400">{description}</span>
    {/if}
  </span>
  <span class="relative h-6 w-11 shrink-0 rounded-full transition {checked ? 'bg-primary-600' : 'bg-slate-700'}">
    <span
      class="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition {checked ? 'left-6' : 'left-1'}"
    ></span>
  </span>
</button>
