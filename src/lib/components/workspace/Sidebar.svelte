<script lang="ts">
  import BrandMark from '$lib/components/brand/BrandMark.svelte';
  import { navItems } from '$lib/components/layout/navItems';
  import { ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';

  export let pathname: string;
  export let collapsed = false;
  export let mobileOpen = false;

  const dispatch = createEventDispatcher<{ closeMobile: void }>();

  $: mainItems = navItems.filter((item) => (item.section ?? 'main') === 'main');
  $: resourceItems = navItems.filter((item) => item.section === 'resources');
</script>

{#if mobileOpen}
  <button
    type="button"
    class="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
    aria-label="Close navigation overlay"
    on:click={() => dispatch('closeMobile')}
  ></button>
{/if}

<aside
  class="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-zinc-900 bg-black transition-transform duration-200 lg:w-[var(--hf-sidebar-width)] {mobileOpen
    ? 'translate-x-0'
    : '-translate-x-full lg:translate-x-0'}"
>
  <div class="flex h-16 items-center gap-3 border-b border-zinc-900 px-3">
    <a href="/dashboard" class="flex min-w-0 flex-1 items-center gap-3">
      <BrandMark size={collapsed ? 26 : 30} />
      {#if !collapsed}
        <span class="min-w-0">
          <span class="block text-sm font-semibold tracking-normal text-zinc-50">HuntFlow</span>
          <span class="block truncate text-[11px] text-zinc-500">by xalgorix</span>
        </span>
      {/if}
    </a>
    <button
      type="button"
      class="hf-icon-button lg:hidden"
      aria-label="Close navigation"
      on:click={() => dispatch('closeMobile')}
    >
      <X size={16} aria-hidden="true" />
    </button>
  </div>

  <nav class="hf-sidebar-nav flex-1 overflow-y-auto px-2 py-3">
    <div class="space-y-1">
      {#each mainItems as item}
        {@const active = item.match(pathname)}
        <a
          href={item.href}
          class="group flex min-h-[40px] items-center gap-3 rounded-lg text-sm font-medium transition {collapsed
            ? 'justify-center px-0'
            : 'px-3'} {active
            ? 'bg-zinc-900 text-zinc-50'
            : 'text-zinc-500 hover:bg-zinc-950 hover:text-zinc-200'}"
          title={collapsed ? item.label : undefined}
          on:click={() => dispatch('closeMobile')}
        >
          <svelte:component this={item.icon} size={17} aria-hidden="true" />
          {#if !collapsed}
            <span class="truncate">{item.label}</span>
          {/if}
        </a>
      {/each}
    </div>

    {#if !collapsed}
      <div class="mt-5 border-t border-zinc-900 pt-3">
        <p class="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">Resources</p>
        <div class="space-y-1">
          {#each resourceItems as item}
            {@const active = item.match(pathname)}
            <a
              href={item.href}
              class="group flex min-h-[38px] items-center gap-3 rounded-lg px-3 text-sm font-medium transition {active
                ? 'bg-zinc-900 text-zinc-50'
                : 'text-zinc-500 hover:bg-zinc-950 hover:text-zinc-200'}"
              on:click={() => dispatch('closeMobile')}
            >
              <svelte:component this={item.icon} size={16} aria-hidden="true" />
              <span class="truncate">{item.label}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </nav>

  <div class="hidden border-t border-zinc-900 p-2 lg:block">
    <button
      type="button"
      class="flex min-h-[40px] w-full items-center justify-center gap-2 rounded-lg text-sm text-zinc-500 transition hover:bg-zinc-950 hover:text-zinc-200"
      aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      on:click={() => (collapsed = !collapsed)}
    >
      {#if collapsed}
        <ChevronRight size={16} aria-hidden="true" />
      {:else}
        <ChevronLeft size={16} aria-hidden="true" />
        <span>Collapse</span>
      {/if}
    </button>
  </div>
</aside>

<style>
  .hf-sidebar-nav {
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
  }

  .hf-sidebar-nav::-webkit-scrollbar {
    width: 6px;
  }

  .hf-sidebar-nav::-webkit-scrollbar-track {
    background: transparent;
  }

  .hf-sidebar-nav::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #3f3f46;
  }
</style>
