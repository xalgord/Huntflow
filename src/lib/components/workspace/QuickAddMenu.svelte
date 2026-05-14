<script lang="ts">
  import {
    CircleDollarSign,
    FileText,
    FolderKanban,
    Plus,
    ShieldAlert,
    Target,
    Timer
  } from 'lucide-svelte';

  let open = false;

  const items = [
    { label: 'Program', href: '/programs?new=1', icon: FolderKanban },
    { label: 'Target asset', href: '/targets?new=1', icon: Target },
    { label: 'Hunt session', href: '/timer', icon: Timer },
    { label: 'Note', href: '/notes/new', icon: FileText },
    { label: 'Finding', href: '/findings?new=1', icon: ShieldAlert },
    { label: 'Report', href: '/reports?new=1', icon: FileText },
    { label: 'Payout', href: '/payouts?new=1', icon: CircleDollarSign }
  ];
</script>

<div class="relative">
  <button type="button" class="hf-button-secondary min-h-[40px]" on:click={() => (open = !open)}>
    <Plus size={16} aria-hidden="true" />
    Quick Add
  </button>

  {#if open}
    <div
      class="fixed inset-0 z-40"
      role="presentation"
      on:click={() => (open = false)}
    ></div>
    <div class="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-dark-xl">
      <div class="border-b border-zinc-800 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">
        Create
      </div>
      <div class="p-1.5">
        {#each items as item}
          <a
            href={item.href}
            class="flex min-h-[40px] items-center gap-3 rounded-lg px-3 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-50"
            on:click={() => (open = false)}
          >
            <svelte:component this={item.icon} size={15} aria-hidden="true" />
            {item.label}
          </a>
        {/each}
      </div>
    </div>
  {/if}
</div>
