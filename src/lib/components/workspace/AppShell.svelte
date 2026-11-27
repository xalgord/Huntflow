<script lang="ts">
  import { navItems, tabNavItems } from '$lib/components/layout/navItems';
  import StorageStatusBanner from '$lib/components/pwa/StorageStatusBanner.svelte';
  import { MoreHorizontal } from 'lucide-svelte';
  import Sidebar from './Sidebar.svelte';
  import Topbar from './Topbar.svelte';

  export let pathname: string;
  export let collapsed = false;

  let mobileOpen = false;

  $: sidebarWidth = collapsed ? '3.75rem' : '15rem';
  $: current = navItems.find((item) => item.match(pathname));
  $: onTab = tabNavItems.some((item) => item.match(pathname));
</script>

<div class="min-h-screen text-zinc-50" style={`--hf-sidebar-width: ${sidebarWidth}`}>
  <a
    href="#main-content"
    data-print="hide"
    class="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
  >
    Skip to content
  </a>
  <div data-print="hide" class="contents">
    <Sidebar {pathname} bind:collapsed {mobileOpen} on:closeMobile={() => (mobileOpen = false)} />
  </div>
  <div
    data-print="flat"
    class="min-h-screen transition-[padding] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:pl-[calc(var(--hf-sidebar-width)+0.5rem)]"
  >
    <div data-print="hide" class="contents">
      <Topbar title={current?.label ?? ''} on:openMobileNav={() => (mobileOpen = true)} />
    </div>
    <!-- Each page renders its own <main> landmark; this is only the frame. -->
    <div id="main-content" tabindex="-1" data-print="flat" class="min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[3.25rem] outline-none lg:pb-0">
      <div data-print="hide" class="contents"><StorageStatusBanner /></div>
      <slot />
    </div>
  </div>

  <!-- Floating glass tab bar (iOS) -->
  <nav
    data-print="hide"
    class="hf-material hf-rim hf-floating-pane fixed inset-x-3 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md rounded-[28px] lg:hidden"
    aria-label="Tab bar"
  >
    <ul class="grid h-[3.625rem] grid-cols-5 px-1">
      {#each tabNavItems as item}
        {@const active = item.match(pathname)}
        <li class="flex">
          <a
            href={item.href}
            class="hf-tab {active ? 'hf-tab--active text-primary' : 'text-zinc-500'}"
            aria-current={active ? 'page' : undefined}
          >
            <svelte:component this={item.icon} size={20} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
            {item.label}
          </a>
        </li>
      {/each}
      <li class="flex">
        <button
          type="button"
          class="hf-tab {onTab ? 'text-zinc-500' : 'hf-tab--active text-primary'}"
          aria-label="More sections"
          on:click={() => (mobileOpen = true)}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
          More
        </button>
      </li>
    </ul>
  </nav>
</div>

<style>
  .hf-tab {
    display: flex;
    flex: 1;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.125rem;
    margin: 0.3125rem 0.125rem;
    min-height: 0;
    border-radius: 22px;
    font-size: 0.625rem;
    font-weight: 600;
    transition: background-color 200ms ease, color 200ms ease;
  }

  .hf-tab--active {
    background: var(--hf-glass-selected);
    box-shadow:
      inset 0 1px 0 var(--hf-glass-sheen),
      0 0 0 0.5px var(--hf-glass-edge);
  }

  .hf-tab:active {
    transform: scale(0.96);
  }
</style>
