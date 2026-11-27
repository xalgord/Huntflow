<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { navItems, navSections } from '$lib/components/layout/navItems';
  import { navTargets } from '$lib/utils/shortcuts';
  import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let pathname: string;
  export let collapsed = false;
  export let mobileOpen = false;

  const dispatch = createEventDispatcher<{ closeMobile: void }>();

  const shortcutFor = (href: string): string | undefined => {
    const target = navTargets.find((candidate) => candidate.href === href);
    return target ? target.keys.join(' ').toUpperCase() : undefined;
  };

  $: groups = navSections
    .filter((section) => section.id !== 'system')
    .map((section) => ({ ...section, items: navItems.filter((item) => item.section === section.id) }))
    .filter((group) => group.items.length > 0);
  $: systemItems = navItems.filter((item) => item.section === 'system');
  // On phones the sheet always shows labels, even if the desktop rail is collapsed.
  $: rail = collapsed && !mobileOpen;

  function tooltip(label: string, href: string): string {
    const keys = shortcutFor(href);
    return keys ? `${label}  ${keys}` : label;
  }
</script>

{#if mobileOpen}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/25 animate-fade-in backdrop-blur-[2px] lg:hidden"
    aria-label="Close navigation overlay"
    on:click={() => dispatch('closeMobile')}
  ></button>
{/if}

<aside
  class="hf-sidebar-material hf-rim hf-floating-pane fixed bottom-2 left-2 top-[max(0.5rem,env(safe-area-inset-top))] z-50 flex w-[17rem] flex-col rounded-[22px] transition-[transform,width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:w-[var(--hf-sidebar-width)] {mobileOpen
    ? 'translate-x-0'
    : '-translate-x-[calc(100%+1rem)] lg:translate-x-0'}"
  aria-label="Primary"
>
  <div class="flex h-[3.25rem] shrink-0 items-center gap-2.5 {rail ? 'justify-center px-2' : 'px-4'}">
    <a href="/dashboard" class="flex min-w-0 items-center gap-2.5" aria-label="HuntFlow home">
      <BrandMark size={rail ? 24 : 22} />
      {#if !rail}
        <span class="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-zinc-50">HuntFlow</span>
      {/if}
    </a>
    {#if !rail}
      <button
        type="button"
        class="hf-icon-button ml-auto hidden lg:inline-flex"
        aria-label="Collapse sidebar"
        title="Collapse sidebar"
        on:click={() => (collapsed = true)}
      >
        <PanelLeftClose size={16} aria-hidden="true" />
      </button>
    {/if}
    <button
      type="button"
      class="hf-icon-button ml-auto lg:hidden"
      aria-label="Close navigation"
      on:click={() => dispatch('closeMobile')}
    >
      <X size={16} aria-hidden="true" />
    </button>
  </div>

  <nav class="flex-1 overflow-y-auto px-2.5 pb-3" aria-label="Sections">
    {#each groups as group}
      <div class="mb-3">
        {#if group.label && !rail}
          <p class="px-2 pb-1 pt-2 text-[0.6875rem] font-semibold text-zinc-500">{group.label}</p>
        {:else if group.label}
          <div class="mx-2 my-2 h-px bg-zinc-800/60" aria-hidden="true"></div>
        {/if}
        <ul class="space-y-px">
          {#each group.items as item}
            {@const active = item.match(pathname)}
            <li>
              <a
                href={item.href}
                class="hf-source-item {active ? 'hf-source-item--active' : ''} {rail ? 'justify-center' : ''}"
                aria-current={active ? 'page' : undefined}
                title={rail ? tooltip(item.label, item.href) : undefined}
                on:click={() => dispatch('closeMobile')}
              >
                <svelte:component this={item.icon} size={16} strokeWidth={2} class="hf-source-icon shrink-0" aria-hidden="true" />
                {#if !rail}
                  <span class="truncate">{item.label}</span>
                {/if}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/each}
  </nav>

  <div class="shrink-0 px-2.5 pb-3 pt-1">
    {#each systemItems as item}
      {@const active = item.match(pathname)}
      <a
        href={item.href}
        class="hf-source-item {active ? 'hf-source-item--active' : ''} {rail ? 'justify-center' : ''}"
        aria-current={active ? 'page' : undefined}
        title={rail ? tooltip(item.label, item.href) : undefined}
        on:click={() => dispatch('closeMobile')}
      >
        <svelte:component this={item.icon} size={16} strokeWidth={2} class="hf-source-icon shrink-0" aria-hidden="true" />
        {#if !rail}
          <span class="truncate">{item.label}</span>
        {/if}
      </a>
    {/each}
    {#if rail}
      <button
        type="button"
        class="hf-source-item mt-1 hidden justify-center lg:flex"
        aria-label="Expand sidebar"
        title="Expand sidebar"
        on:click={() => (collapsed = false)}
      >
        <PanelLeftOpen size={16} class="hf-source-icon" aria-hidden="true" />
      </button>
    {/if}
  </div>
</aside>

<style>
  .hf-source-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    min-height: 1.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 9px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: hsl(var(--hf-gray-text-200));
    transition: background-color 120ms ease;
  }

  .hf-source-item:hover {
    background: var(--hf-fill);
  }

  .hf-source-item--active,
  .hf-source-item--active:hover {
    background: var(--hf-glass-selected);
    color: hsl(var(--hf-gray-text-50));
    box-shadow:
      inset 0 1px 0 var(--hf-glass-sheen),
      0 0 0 0.5px var(--hf-glass-edge),
      0 2px 6px -2px rgb(0 0 0 / 0.12);
  }

  .hf-source-item :global(.hf-source-icon) {
    color: hsl(var(--primary));
  }

  @media (pointer: coarse) {
    .hf-source-item {
      min-height: 2.75rem;
      font-size: 0.9375rem;
    }
  }
</style>
