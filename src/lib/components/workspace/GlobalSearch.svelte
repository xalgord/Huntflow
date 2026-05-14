<script lang="ts">
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { Search } from 'lucide-svelte';

  export let compact = false;
</script>

<button
  type="button"
  class="flex min-h-[40px] min-w-0 items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 text-left text-sm text-zinc-500 shadow-inner-line transition hover:border-zinc-700 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40 {compact
    ? 'w-10 justify-center px-0'
    : 'w-full'}"
  aria-label="Open global search"
  on:click={() => commandPaletteStore.open()}
>
  <Search size={16} aria-hidden="true" />
  {#if !compact}
    <span class="min-w-0 flex-1 truncate">Search programs, targets, notes, findings...</span>
    <kbd class="hidden rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:inline-flex">
      Ctrl K
    </kbd>
  {/if}
</button>
