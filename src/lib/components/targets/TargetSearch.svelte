<script lang="ts">
  import { Search, X } from 'lucide-svelte';
  import { createEventDispatcher, onDestroy } from 'svelte';

  export let value = '';

  const dispatch = createEventDispatcher<{ search: { value: string } }>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  $: {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => dispatch('search', { value: value.trim() }), 300);
  }

  onDestroy(() => {
    if (timer) clearTimeout(timer);
  });
</script>

<label class="relative block">
  <span class="sr-only">Search targets</span>
  <Search class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
  <input
    bind:value
    class="min-h-[44px] w-full rounded-md border border-slate-600 bg-slate-850 py-2.5 pl-10 pr-10 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
    placeholder="Search targets"
  />
  {#if value}
    <button
      type="button"
      class="absolute right-1 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
      aria-label="Clear search"
      on:click={() => (value = '')}
    >
      <X size={18} aria-hidden="true" />
    </button>
  {/if}
</label>
