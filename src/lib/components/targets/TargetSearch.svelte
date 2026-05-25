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
  <Search class="pointer-events-none absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-500" size={18} />
  <input
    bind:value
    class="min-h-[44px] w-full rounded-md border border-zinc-600 bg-zinc-850 py-2.5 pl-10 pr-10 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
    placeholder="Search targets"
  />
  {#if value}
    <button
      type="button"
      class="absolute right-1 top-1/2 inline-flex h-10 w-10 -tranzinc-y-1/2 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
      aria-label="Clear search"
      on:click={() => (value = '')}
    >
      <X size={18} aria-hidden="true" />
    </button>
  {/if}
</label>
