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
  class="flex min-h-[44px] w-full items-center justify-between gap-4 rounded-[10px] px-3 py-2 text-left transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
  on:click={toggle}
>
  <span>
    <span class="block text-[0.8125rem] font-medium text-zinc-100">{label}</span>
    {#if description}
      <span class="mt-0.5 block text-xs leading-5 text-zinc-500">{description}</span>
    {/if}
  </span>
  <span
    class="relative h-[1.375rem] w-[2.375rem] shrink-0 rounded-full transition-colors duration-200 {checked ? 'bg-green-500' : ''}"
    style={checked ? '' : 'background: var(--hf-fill-strong)'}
    aria-hidden="true"
  >
    <span
      class="absolute top-[2px] h-[1.125rem] w-[1.125rem] rounded-full bg-white shadow-[0_2px_4px_rgb(0_0_0/0.2),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-all duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] {checked
        ? 'left-[calc(100%-1.125rem-2px)]'
        : 'left-[2px]'}"
    ></span>
  </span>
</button>
