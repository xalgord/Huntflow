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
  import { onMount, tick } from 'svelte';

  let open = false;
  let menu: HTMLDivElement | undefined;
  let trigger: HTMLButtonElement | undefined;

  const groups = [
    [
      { label: 'New Finding', href: '/findings?new=1', icon: ShieldAlert },
      { label: 'New Note', href: '/notes/new', icon: FileText }
    ],
    [
      { label: 'New Program', href: '/programs?new=1', icon: FolderKanban },
      { label: 'New Target', href: '/targets?new=1', icon: Target },
      { label: 'Start Session', href: '/timer', icon: Timer }
    ],
    [{ label: 'Record Payout', href: '/payouts?new=1', icon: CircleDollarSign }]
  ];

  async function toggle(): Promise<void> {
    open = !open;
    if (open) {
      await tick();
      menu?.querySelector<HTMLElement>('a')?.focus();
    }
  }

  function close(returnFocus = false): void {
    open = false;
    if (returnFocus) trigger?.focus();
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!open) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close(true);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(menu?.querySelectorAll<HTMLElement>('a') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
    items[(next + items.length) % items.length]?.focus();
    event.preventDefault();
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="relative">
  <button
    bind:this={trigger}
    type="button"
    class="hf-icon-button"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-label="Create new"
    title="Create new"
    on:click={toggle}
  >
    <Plus size={19} aria-hidden="true" />
  </button>

  {#if open}
    <div class="fixed inset-0 z-40" role="presentation" on:click={() => close()}></div>
    <div
      bind:this={menu}
      class="hf-material absolute right-0 top-[calc(100%+0.375rem)] z-50 w-52 animate-scale-in rounded-[10px] p-[5px] shadow-dark-lg"
      style="transform-origin: top right"
      role="menu"
    >
      {#each groups as group, groupIndex}
        {#if groupIndex > 0}
          <div class="mx-2 my-[5px] h-px bg-zinc-800" role="separator"></div>
        {/if}
        {#each group as item}
          <a href={item.href} class="hf-menu-item" role="menuitem" on:click={() => close()}>
            <svelte:component this={item.icon} size={15} aria-hidden="true" />
            {item.label}
          </a>
        {/each}
      {/each}
    </div>
  {/if}
</div>

<style>
  .hf-menu-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    min-height: 1.75rem;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    color: hsl(var(--hf-gray-text-100));
    outline: none;
  }

  .hf-menu-item:hover,
  .hf-menu-item:focus-visible {
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
</style>
