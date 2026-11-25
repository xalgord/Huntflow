<script lang="ts">
  import { browser } from '$app/environment';
  import { commandPaletteStore } from '$lib/stores/commandPaletteStore';
  import { Search } from 'lucide-svelte';

  export let compact = false;

  const isMac = browser && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
</script>

{#if compact}
  <button
    type="button"
    class="hf-icon-button"
    aria-label="Search"
    on:click={() => commandPaletteStore.open()}
  >
    <Search size={17} aria-hidden="true" />
  </button>
{:else}
  <button
    type="button"
    class="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-left text-[0.8125rem] text-zinc-500 transition hover:text-zinc-400"
    style="background: var(--hf-fill)"
    aria-label="Search everything"
    on:click={() => commandPaletteStore.open()}
  >
    <Search size={14} strokeWidth={2.2} aria-hidden="true" />
    <span class="min-w-0 flex-1 truncate">Search</span>
    <kbd class="hf-kbd">{isMac ? '⌘K' : 'Ctrl K'}</kbd>
  </button>
{/if}
